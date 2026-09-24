import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const pageArgs = (q: PaginationQuery) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });
export const pageMeta = (q: PaginationQuery, total: number) => ({
  page: q.page,
  pageSize: q.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
});
export const orderBy = (q: PaginationQuery, allowed: string[], fallback = 'createdAt') => ({
  [q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : fallback]: q.sortOrder,
});
