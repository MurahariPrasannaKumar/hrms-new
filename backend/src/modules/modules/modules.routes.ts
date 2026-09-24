import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ApiError } from '../../utils/ApiError';
import { audit } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { getEnabledModuleKeys } from './modules.service';

const keyParam = z.object({ key: z.string().min(1) });
const schoolKeyParam = z.object({ schoolId: z.string().uuid(), key: z.string().min(1) });
const toggle = z.object({ enabled: z.boolean() });
const listQuery = z.object({ schoolId: z.string().uuid().optional() });

export const modulesRouter = Router();
modulesRouter.use(requireAuth);

// Modules the current user's school may use (any authenticated user).
modulesRouter.get('/enabled', asyncHandler(async (req: Request, res: Response) => {
  ok(res, await getEnabledModuleKeys(req.user!.schoolId));
}));

// Admin view: platform switch plus per-school state when ?schoolId= is given.
modulesRouter.get('/', requireRole('SUPER_ADMIN'), requirePermission('modules.manage'), validate(listQuery, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = req.query as { schoolId?: string };
    const modules = await prisma.module.findMany({
      orderBy: { sortOrder: 'asc' },
      include: schoolId ? { schoolModules: { where: { schoolId } } } : undefined,
    });
    ok(res, modules.map((m) => {
      const override = (m as { schoolModules?: { enabled: boolean }[] }).schoolModules?.[0];
      return {
        key: m.key, name: m.name, description: m.description, enabled: m.enabled,
        ...(schoolId ? { schoolEnabled: override ? override.enabled : true } : {}),
      };
    }));
  }));

modulesRouter.patch('/:key', requireRole('SUPER_ADMIN'), requirePermission('modules.manage'), validate(keyParam, 'params'), validate(toggle),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.key as string;
    if (!(await prisma.module.findUnique({ where: { key } }))) throw ApiError.notFound('Module not found');
    const mod = await prisma.module.update({ where: { key }, data: { enabled: req.body.enabled } });
    await audit(req, { action: 'UPDATE', resource: 'MODULE', resourceId: mod.id, schoolId: null, metadata: { key, enabled: mod.enabled } });
    ok(res, mod, 'Module updated');
  }));

modulesRouter.put('/school/:schoolId/:key', requireRole('SUPER_ADMIN'), requirePermission('modules.manage'), validate(schoolKeyParam, 'params'), validate(toggle),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId, key } = req.params as { schoolId: string; key: string };
    const [school, mod] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      prisma.module.findUnique({ where: { key } }),
    ]);
    if (!school || !mod) throw ApiError.notFound('School or module not found');
    const row = await prisma.schoolModule.upsert({
      where: { schoolId_moduleId: { schoolId, moduleId: mod.id } },
      update: { enabled: req.body.enabled },
      create: { schoolId, moduleId: mod.id, enabled: req.body.enabled },
    });
    await audit(req, { action: 'UPDATE', resource: 'SCHOOL_MODULE', resourceId: mod.id, schoolId, metadata: { key, enabled: row.enabled } });
    ok(res, { schoolId, key, enabled: row.enabled }, 'School module updated');
  }));
