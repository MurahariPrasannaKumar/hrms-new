import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { reportsController as c } from './reports.controller';
import { reportParamSchema, reportQuerySchema } from './reports.validation';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);
reportsRouter.get('/:type', requirePermission('reports.read'), validate(reportParamSchema, 'params'), validate(reportQuerySchema, 'query'), asyncHandler(c.run));
