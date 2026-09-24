import type { Request } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Resolve the school a request operates on. The tenant is always derived from the
 * authenticated user; only SUPER_ADMIN may target another school (via ?schoolId= / body.schoolId).
 */
export const resolveSchoolId = (req: Request, requested?: string | null): string => {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (user.role === 'SUPER_ADMIN') {
    if (!requested) throw ApiError.badRequest('schoolId is required for platform administrators');
    return requested;
  }
  if (!user.schoolId) throw ApiError.forbidden('Account is not associated with a school');
  return user.schoolId;
};

/** Optional scope: SUPER_ADMIN without a school filter sees everything (returns undefined). */
export const optionalSchoolScope = (req: Request, requested?: string | null): string | undefined => {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (user.role === 'SUPER_ADMIN') return requested ?? undefined;
  if (!user.schoolId) throw ApiError.forbidden('Account is not associated with a school');
  return user.schoolId;
};
