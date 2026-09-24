import type { Request, Response } from 'express';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { usersService } from './users.service';

const id = (req: Request) => req.params.id as string;

export const usersController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await usersService.list(req.user!, req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async get(req: Request, res: Response) {
    ok(res, await usersService.get(req.user!, id(req)));
  },
  async create(req: Request, res: Response) {
    const user = await usersService.create(req.user!, req.body);
    await audit(req, { action: 'CREATE', resource: 'USER', resourceId: user.id, schoolId: user.schoolId, metadata: { role: user.role.name } });
    ok(res, user, 'User created', 201);
  },
  async update(req: Request, res: Response) {
    const user = await usersService.update(req.user!, id(req), req.body);
    await audit(req, { action: 'UPDATE', resource: 'USER', resourceId: user.id, schoolId: user.schoolId, metadata: { fields: Object.keys(req.body) } });
    ok(res, user, 'User updated');
  },
  async remove(req: Request, res: Response) {
    const user = await usersService.deactivate(req.user!, id(req));
    await audit(req, { action: 'DEACTIVATE', resource: 'USER', resourceId: user.id, schoolId: user.schoolId });
    ok(res, user, 'User deactivated');
  },
  async destroy(req: Request, res: Response) {
    const user = await usersService.remove(req.user!, id(req));
    await audit(req, { action: 'DELETE', resource: 'USER', resourceId: user.id, schoolId: user.schoolId, metadata: { email: user.email } });
    ok(res, null, 'User deleted');
  },
  async resetPassword(req: Request, res: Response) {
    await usersService.setPassword(req.user!, id(req), req.body.password);
    await audit(req, { action: 'SET_PASSWORD', resource: 'USER', resourceId: id(req) });
    ok(res, null, 'Password updated');
  },
};
