import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler, ok } from '../../utils/http';
import { usageService } from './usage.service';

export const usageRouter = Router();
usageRouter.use(requireAuth, requireRole('STUDENT', 'TEACHER'));

usageRouter.get('/today', asyncHandler(async (req, res) => {
  ok(res, await usageService.today(req.user!.id, req.user!.schoolId));
}));

usageRouter.post('/heartbeat', validate(z.object({ seconds: z.number().min(0).max(600) })), asyncHandler(async (req, res) => {
  ok(res, await usageService.heartbeat(req.user!, req.body.seconds));
}));
