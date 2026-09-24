import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { orderBy, pageArgs, pageMeta } from '../../utils/pagination';
import type { z } from 'zod';
import { schoolsRepository as repo } from './schools.repository';
import type { createSchoolSchema, listSchoolsSchema, updateSchoolSchema } from './schools.validation';

const SORTABLE = ['name', 'code', 'city', 'status', 'createdAt'];

const assertAccess = (user: AuthUser, id: string) => {
  if (user.role !== 'SUPER_ADMIN' && user.schoolId !== id) throw ApiError.forbidden();
};

export const schoolsService = {
  async list(q: z.infer<typeof listSchoolsSchema>) {
    const where: Prisma.SchoolWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.city && { city: { contains: q.city, mode: 'insensitive' } }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { code: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await repo.list(where, orderBy(q, SORTABLE), pageArgs(q).skip, pageArgs(q).take);
    return { items, meta: pageMeta(q, total) };
  },

  async get(user: AuthUser, id: string) {
    assertAccess(user, id);
    const school = await repo.findById(id);
    if (!school) throw ApiError.notFound('School not found');
    return school;
  },

  create: (data: z.infer<typeof createSchoolSchema>) => repo.create(data),

  async update(user: AuthUser, id: string, data: z.infer<typeof updateSchoolSchema>) {
    assertAccess(user, id);
    if (user.role !== 'SUPER_ADMIN') {
      // School admins may edit the profile but not identity/status.
      delete data.code;
      delete data.status;
    }
    if (!(await repo.findById(id))) throw ApiError.notFound('School not found');
    return repo.update(id, data);
  },

  async remove(id: string) {
    if (!(await repo.findById(id))) throw ApiError.notFound('School not found');
    await repo.remove(id);
  },
};
