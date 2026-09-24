import type { Request, Response } from 'express';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { settingsService } from './settings.service';

export const settingsController = {
  async getSystem(_req: Request, res: Response) {
    ok(res, await settingsService.getSystem());
  },
  async putSystem(req: Request, res: Response) {
    const data = await settingsService.putSystem(req.body);
    await audit(req, { action: 'UPDATE', resource: 'SYSTEM_SETTINGS', metadata: data });
    ok(res, data, 'Settings saved');
  },
  async getSchool(req: Request, res: Response) {
    ok(res, await settingsService.getSchool(req, req.query.schoolId as string | undefined));
  },
  async putSchool(req: Request, res: Response) {
    const data = await settingsService.putSchool(req, req.query.schoolId as string | undefined, req.body);
    await audit(req, { action: 'UPDATE', resource: 'SCHOOL_SETTINGS', resourceId: data.schoolId, schoolId: data.schoolId, metadata: { fields: Object.keys(req.body) } });
    ok(res, data, 'Settings saved');
  },
};
