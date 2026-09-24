import type { Request, Response } from 'express';
import { ok } from '../../utils/http';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await notificationsService.list(req.user!.id, req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async markRead(req: Request, res: Response) {
    ok(res, await notificationsService.markRead(req.params.id, req.user!.id), 'Marked as read');
  },
  async markAllRead(req: Request, res: Response) {
    ok(res, await notificationsService.markAllRead(req.user!.id), 'All notifications marked as read');
  },
};
