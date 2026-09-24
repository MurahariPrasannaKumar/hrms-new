import type { Request, Response } from 'express';
import { ok } from '../../utils/http';
import { searchService } from './search.service';

export const searchController = {
  async search(req: Request, res: Response) {
    ok(res, await searchService.search(req, req.query as never));
  },
};
