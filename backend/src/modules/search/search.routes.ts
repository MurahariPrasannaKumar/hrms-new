import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { searchController as c } from './search.controller';
import { searchSchema } from './search.validation';

export const searchRouter = Router();
searchRouter.use(requireAuth);
searchRouter.get('/', validate(searchSchema, 'query'), asyncHandler(c.search));
