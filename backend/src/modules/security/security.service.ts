import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { orderBy, pageArgs, pageMeta } from '../../utils/pagination';
import type { auditLogQuerySchema, loginActivityQuerySchema, sessionQuerySchema } from './security.validation';

const range = (from?: Date, to?: Date) => (from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {});
const isSuper = (u: AuthUser) => u.role === 'SUPER_ADMIN';

/** Non-super admins are pinned to their own school; the client value is ignored. */
const scope = (u: AuthUser, requested?: string) => (isSuper(u) ? requested : u.schoolId!);

const userLite = { select: { id: true, firstName: true, lastName: true, email: true } };

export const securityService = {
  async auditLogs(u: AuthUser, q: z.infer<typeof auditLogQuerySchema>) {
    const schoolId = scope(u, q.schoolId);
    const where: Prisma.AuditLogWhereInput = {
      ...(schoolId && { schoolId }),
      ...(q.userId && { userId: q.userId }),
      ...(q.action && { action: { equals: q.action, mode: 'insensitive' } }),
      ...(q.resource && { resource: { equals: q.resource, mode: 'insensitive' } }),
      ...range(q.from, q.to),
      ...(q.search && {
        OR: [
          { action: { contains: q.search, mode: 'insensitive' } },
          { resource: { contains: q.search, mode: 'insensitive' } },
          { resourceId: { contains: q.search, mode: 'insensitive' } },
          { user: { email: { contains: q.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: orderBy(q, ['createdAt', 'action', 'resource']), ...pageArgs(q), include: { user: userLite } }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, meta: pageMeta(q, total) };
  },

  async loginActivity(u: AuthUser, q: z.infer<typeof loginActivityQuerySchema>, failedOnly = false) {
    const where: Prisma.LoginAttemptWhereInput = {
      ...(!isSuper(u) && { user: { schoolId: u.schoolId! } }),
      ...(failedOnly ? { success: false } : q.success && { success: q.success === 'true' }),
      ...range(q.from, q.to),
      ...(q.search && { email: { contains: q.search, mode: 'insensitive' } }),
    };
    const [items, total] = await Promise.all([
      prisma.loginAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      prisma.loginAttempt.count({ where }),
    ]);
    return { items, meta: pageMeta(q, total) };
  },

  async sessions(u: AuthUser, q: z.infer<typeof sessionQuerySchema>) {
    const where: Prisma.SessionWhereInput = {
      revokedAt: null,
      ...(!isSuper(u) && { user: { schoolId: u.schoolId! } }),
      ...(q.userId && { userId: q.userId }),
    };
    const [items, total] = await Promise.all([
      prisma.session.findMany({
        where, orderBy: { lastSeenAt: 'desc' }, ...pageArgs(q),
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastSeenAt: true, user: userLite },
      }),
      prisma.session.count({ where }),
    ]);
    return { items, meta: pageMeta(q, total) };
  },

  async revokeSession(u: AuthUser, id: string) {
    const session = await prisma.session.findUnique({ where: { id }, include: { user: { select: { schoolId: true } } } });
    if (!session || (!isSuper(u) && session.user.schoolId !== u.schoolId)) throw ApiError.notFound('Session not found');
    await prisma.$transaction([
      prisma.session.update({ where: { id }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return session.user.schoolId;
  },
};
