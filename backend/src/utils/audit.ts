import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface AuditInput {
  action: string;
  resource: string;
  resourceId?: string | null;
  schoolId?: string | null;
  metadata?: Prisma.InputJsonValue;
  userId?: string | null;
}

export const audit = async (req: Request, input: AuditInput) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? req.user?.id ?? null,
        schoolId: input.schoolId ?? req.user?.schoolId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
};
