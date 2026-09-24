import type { Request, Response } from 'express';
import { ok } from '../../utils/http';
import { attendanceSelfService as self } from './attendance-self.service';
import { attendanceService as s } from './attendance.service';

export const attendanceController = {
  async mark(req: Request, res: Response) {
    ok(res, await s.mark(req, req.body), 'Attendance saved', 201);
  },
  async list(req: Request, res: Response) {
    const { items, meta } = await s.list(req, req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async roster(req: Request, res: Response) {
    ok(res, await s.roster(req, req.query as never));
  },
  async summary(req: Request, res: Response) {
    ok(res, await s.summary(req, req.query as never));
  },
  async studentCheckIn(req: Request, res: Response) {
    ok(res, await self.studentCheckIn(req), 'Attendance marked', 201);
  },
  async me(req: Request, res: Response) {
    ok(res, await self.studentOverview(req, req.query as never));
  },
  async teacherCheckIn(req: Request, res: Response) {
    ok(res, await self.teacherCheckIn(req), 'Checked in', 201);
  },
  async teacherMe(req: Request, res: Response) {
    ok(res, await self.teacherOverview(req, req.query as never));
  },
  async update(req: Request, res: Response) {
    ok(res, await s.updateRecord(req, req.params.id, req.body), 'Attendance updated');
  },
};
