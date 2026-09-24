import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { audit } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { profileService } from './profile.service';
import { teachingClassesSchema, updateProfileSchema } from './profile.validation';

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/', asyncHandler(async (req, res) => { ok(res, await profileService.get(req.user!)); }));

profileRouter.patch('/', validate(updateProfileSchema), asyncHandler(async (req, res) => {
  const profile = await profileService.update(req.user!, req.body);
  await audit(req, { schoolId: req.user!.schoolId, action: 'UPDATE', resource: 'PROFILE', resourceId: req.user!.id });
  ok(res, profile, 'Profile updated');
}));

profileRouter.put('/teaching-classes', validate(teachingClassesSchema), asyncHandler(async (req, res) => {
  const classes = await profileService.setTeachingClasses(req.user!, req.body);
  await audit(req, { schoolId: req.user!.schoolId, action: 'UPDATE', resource: 'PROFILE', resourceId: req.user!.id, metadata: { teachingClasses: classes.length } });
  ok(res, classes, 'Classes updated');
}));
