import type { Request, Response } from 'express';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { schoolsService } from './schools.service';

const id = (req: Request) => req.params.id as string;

export const schoolsController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await schoolsService.list(req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async get(req: Request, res: Response) {
    ok(res, await schoolsService.get(req.user!, id(req)));
  },
  async create(req: Request, res: Response) {
    const school = await schoolsService.create(req.body);
    await audit(req, { action: 'CREATE', resource: 'SCHOOL', resourceId: school.id, schoolId: school.id, metadata: { code: school.code } });
    ok(res, school, 'School created', 201);
  },
  async update(req: Request, res: Response) {
    const school = await schoolsService.update(req.user!, id(req), req.body);
    await audit(req, { action: 'UPDATE', resource: 'SCHOOL', resourceId: school.id, schoolId: school.id, metadata: { fields: Object.keys(req.body) } });
    ok(res, school, 'School updated');
  },
  async remove(req: Request, res: Response) {
    await schoolsService.remove(id(req));
    await audit(req, { action: 'DELETE', resource: 'SCHOOL', resourceId: id(req), schoolId: null });
    ok(res, null, 'School deleted');
  },
};
