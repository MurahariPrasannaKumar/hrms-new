import type { Request, Response } from 'express';
import { ok } from '../../utils/http';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async admin(_req: Request, res: Response) {
    ok(res, await dashboardService.admin());
  },
  async school(req: Request, res: Response) {
    ok(res, await dashboardService.school(req.user!));
  },
  async teacher(req: Request, res: Response) {
    ok(res, await dashboardService.teacher(req.user!));
  },
  async student(req: Request, res: Response) {
    ok(res, await dashboardService.student(req.user!));
  },
  async parent(req: Request, res: Response) {
    ok(res, await dashboardService.parent(req.user!));
  },
};
