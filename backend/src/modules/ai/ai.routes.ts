import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { paginationSchema, pageArgs, pageMeta } from '../../utils/pagination';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler, ok } from '../../utils/http';
import { getEnabledModuleKeys } from '../modules/modules.service';
import { aiService, instasolveService, vBuddyService } from './ai.service';
import { chatSchema, idParamSchema, solveSchema, studyPlanSchema } from './ai.validation';

const requireModule = (key: string) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const enabled = await getEnabledModuleKeys(req.user!.schoolId);
    if (!enabled.includes(key)) throw new ApiError(403, 'MODULE_DISABLED', `The ${key} module is not enabled for your school`);
    next();
  });

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous', // runs after requireAuth
  validate: { ip: false, keyGeneratorIpFallback: false },
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many AI requests', details: [] } },
});

export const aiRouter = Router();
aiRouter.use(requireAuth, requirePermission('ai.use'), aiLimiter);

const vbuddy = requireModule('v-buddy');
const params = validate(idParamSchema, 'params');

aiRouter.get('/v-buddy/suggestions', vbuddy, (_req, res) => ok(res, vBuddyService.suggestions()));
aiRouter.post('/v-buddy/chat', vbuddy, validate(chatSchema), asyncHandler(async (req, res) => {
  ok(res, await vBuddyService.chat(req.user!, req.body), 'Success');
}));
aiRouter.get('/v-buddy/conversations', vbuddy, validate(paginationSchema, 'query'), asyncHandler(async (req, res) => {
  const q = req.query as never as ReturnType<typeof paginationSchema.parse>;
  const { skip, take } = pageArgs(q);
  const [items, total] = await vBuddyService.listConversations(req.user!, skip, take);
  ok(res, items, 'Success', 200, pageMeta(q, total));
}));
aiRouter.get('/v-buddy/conversations/:id', vbuddy, params, asyncHandler(async (req, res) => {
  ok(res, await vBuddyService.getConversation(req.user!, req.params.id as string));
}));
aiRouter.delete('/v-buddy/conversations/:id', vbuddy, params, asyncHandler(async (req, res) => {
  await vBuddyService.deleteConversation(req.user!, req.params.id as string);
  ok(res, null, 'Conversation deleted');
}));
aiRouter.post('/v-buddy/study-plan', vbuddy, validate(studyPlanSchema), asyncHandler(async (req, res) => {
  ok(res, { plan: await aiService.generateStudyPlan(req.user!, req.body) });
}));

aiRouter.post('/instasolve', requireModule('instasolve'), validate(solveSchema), asyncHandler(async (req, res) => {
  ok(res, await instasolveService.solve(req.user!, req.body));
}));
