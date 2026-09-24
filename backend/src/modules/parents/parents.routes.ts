import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler, ok } from '../../utils/http';
import { schoolWhere } from '../common/tenant-scope';

const listQuery = z.object({
  search: z.string().trim().optional(),
  schoolId: z.string().uuid().optional(),
});

export const parentsRouter = Router();
parentsRouter.use(requireAuth);

// Used by the student form's parent picker; only roles that can create/edit students.
parentsRouter.get(
  '/',
  requirePermission('students.create'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as z.infer<typeof listQuery>;
    const items = await prisma.parent.findMany({
      where: {
        ...schoolWhere(req, q.schoolId),
        ...(q.search && {
          user: {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          },
        }),
      },
      select: { id: true, phone: true, user: { select: { firstName: true, lastName: true, email: true } }, _count: { select: { children: true } } },
      orderBy: { user: { firstName: 'asc' } },
      take: 100,
    });
    ok(res, items.map((p) => ({
      id: p.id, name: `${p.user.firstName} ${p.user.lastName}`, email: p.user.email, phone: p.phone, children: p._count.children,
    })));
  }),
);
