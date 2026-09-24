import type { Request, Response } from 'express';
import { ok } from '../../utils/http';
import { noticesService as s } from './notices.service';

export const noticesController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await s.list(req, req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async get(req: Request, res: Response) {
    ok(res, await s.get(req, req.params.id));
  },
  async create(req: Request, res: Response) {
    ok(res, await s.create(req, req.body), 'Notice created', 201);
  },
  async update(req: Request, res: Response) {
    ok(res, await s.update(req, req.params.id, req.body), 'Notice updated');
  },
  async remove(req: Request, res: Response) {
    await s.remove(req, req.params.id);
    ok(res, null, 'Notice deleted');
  },
};
