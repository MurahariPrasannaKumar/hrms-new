import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/database';
import { env, isProd } from '../../config/env';
import { logger } from '../../config/logger';
import { loadAuthUser } from '../../middlewares/auth';
import { ApiError } from '../../utils/ApiError';
import { parseDurationMs, randomToken, sha256 } from '../../utils/crypto';
import { getEnabledModuleKeys } from '../modules/modules.service';

export interface ClientContext {
  ip?: string;
  userAgent?: string;
}

export const SELF_SERVICE_PASSWORD_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN'];
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60_000;
const refreshTtlMs = () => parseDurationMs(env.JWT_REFRESH_EXPIRES_IN);

const signAccess = (userId: string, sessionId: string) =>
  jwt.sign({ sub: userId, sid: sessionId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

const issueRefreshToken = async (userId: string, familyId: string) => {
  const token = randomToken();
  await prisma.refreshToken.create({
    data: { userId, familyId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + refreshTtlMs()) },
  });
  return token;
};

export const buildProfile = async (userId: string) => {
  const auth = await loadAuthUser(userId);
  if (!auth) throw ApiError.unauthorized('Account is inactive');
  const [school, modules] = await Promise.all([
    auth.schoolId
      ? prisma.school.findUnique({ where: { id: auth.schoolId }, select: { id: true, name: true, code: true, logoUrl: true } })
      : null,
    getEnabledModuleKeys(auth.schoolId),
  ]);
  return { ...auth, school, modules };
};

export const authService = {
  async login(identifier: string, password: string, ctx: ClientContext) {
    const since = new Date(Date.now() - LOCK_WINDOW_MS);
    const failures = await prisma.loginAttempt.count({
      where: { email: identifier, success: false, createdAt: { gte: since } },
    });
    if (failures >= MAX_FAILED_ATTEMPTS) {
      throw new ApiError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in a few minutes.');
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      include: { school: { select: { status: true } } },
    });
    const valid = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;

    await prisma.loginAttempt.create({
      data: { userId: user?.id, email: identifier, success: valid, ipAddress: ctx.ip, userAgent: ctx.userAgent },
    });
    if (!user || !valid) throw ApiError.unauthorized('Invalid credentials');
    if (user.status !== 'ACTIVE') throw ApiError.forbidden('Account is not active');
    if (user.school && user.school.status !== 'ACTIVE') throw ApiError.forbidden('School account is inactive');

    const familyId = randomUUID();
    const session = await prisma.session.create({
      data: { userId: user.id, familyId, ipAddress: ctx.ip, userAgent: ctx.userAgent },
    });
    const refreshToken = await issueRefreshToken(user.id, familyId);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      accessToken: signAccess(user.id, session.id),
      refreshToken,
      user: await buildProfile(user.id),
      mustChangePassword: user.mustChangePassword,
    };
  },

  async refresh(token: string, ctx: ClientContext) {
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!stored) throw ApiError.unauthorized('Invalid refresh token');

    if (stored.revokedAt) {
      // Reuse of a rotated token: assume theft and kill the whole family.
      await prisma.$transaction([
        prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.session.updateMany({ where: { familyId: stored.familyId }, data: { revokedAt: new Date() } }),
      ]);
      logger.warn({ userId: stored.userId }, 'Refresh token reuse detected');
      throw ApiError.unauthorized('Refresh token reuse detected');
    }
    if (stored.expiresAt < new Date()) throw ApiError.unauthorized('Refresh token expired');

    const session = await prisma.session.findUnique({ where: { familyId: stored.familyId } });
    if (!session || session.revokedAt) throw ApiError.unauthorized('Session revoked');
    const auth = await loadAuthUser(stored.userId);
    if (!auth) throw ApiError.unauthorized('Account is inactive');

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(), ipAddress: ctx.ip ?? session.ipAddress } });
    return {
      accessToken: signAccess(stored.userId, session.id),
      refreshToken: await issueRefreshToken(stored.userId, stored.familyId),
      user: await buildProfile(stored.userId),
    };
  },

  async logout(token: string | undefined) {
    if (!token) return;
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!stored) return;
    await prisma.$transaction([
      prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.session.updateMany({ where: { familyId: stored.familyId }, data: { revokedAt: new Date() } }),
    ]);
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user || user.status !== 'ACTIVE') return; // never reveal account existence
    if (!SELF_SERVICE_PASSWORD_ROLES.includes(user.role.name)) return; // non-admins must ask an admin
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    // TODO(email provider): send link. Until then the token is only visible in dev logs.
    if (!isProd) logger.info({ email, resetToken: token }, 'Password reset token (dev only)');
  },

  async resetPassword(token: string, password: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw ApiError.badRequest('Reset link is invalid or has expired');
    const passwordHash = await argon2.hash(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, currentPassword))) throw ApiError.badRequest('Current password is incorrect');
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword), mustChangePassword: false },
    });
  },
};
