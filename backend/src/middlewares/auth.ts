import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import type { PermissionKey, RoleName } from '../config/permissions';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/http';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export const loadAuthUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      extraPermissions: { include: { permission: true } },
    },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  const perms = new Set<string>([
    ...user.role.permissions.map((rp) => rp.permission.key),
    ...user.extraPermissions.map((up) => up.permission.key),
  ]);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name as RoleName,
    schoolId: user.schoolId,
    permissions: [...perms] as PermissionKey[],
  };
};

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.userId !== payload.sub) {
    throw ApiError.unauthorized('Session is no longer valid');
  }
  const user = await loadAuthUser(payload.sub);
  if (!user) throw ApiError.unauthorized('Account is inactive');
  req.user = user;
  next();
});

export const requireRole =
  (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

export const requirePermission =
  (...perms: PermissionKey[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!perms.every((p) => req.user!.permissions.includes(p))) return next(ApiError.forbidden());
    next();
  };
