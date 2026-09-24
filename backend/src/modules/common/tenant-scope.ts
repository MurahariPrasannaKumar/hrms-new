import type { Request } from 'express';
import { optionalSchoolScope } from '../../middlewares/tenant';

/** Prisma where-fragment restricting to the caller's tenant (empty for platform admins without a filter). */
export const schoolWhere = (req: Request, requested?: string | null): { schoolId?: string } => {
  const s = optionalSchoolScope(req, requested);
  return s ? { schoolId: s } : {};
};
