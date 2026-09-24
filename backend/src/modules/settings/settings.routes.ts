import { Router } from 'express';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { settingsController as c } from './settings.controller';
import { schoolScopeQuery, schoolSettingsSchema, systemSettingsSchema } from './settings.validation';

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requirePermission('settings.manage'));

settingsRouter.get('/system', requireRole('SUPER_ADMIN'), asyncHandler(c.getSystem));
settingsRouter.put('/system', requireRole('SUPER_ADMIN'), validate(systemSettingsSchema), asyncHandler(c.putSystem));
settingsRouter.get('/school', requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN'), validate(schoolScopeQuery, 'query'), asyncHandler(c.getSchool));
settingsRouter.put('/school', requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN'), validate(schoolScopeQuery, 'query'), validate(schoolSettingsSchema), asyncHandler(c.putSchool));
