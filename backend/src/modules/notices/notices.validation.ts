import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const uuid = z.string().uuid();
const type = z.enum(['GENERAL', 'ACADEMIC', 'EVENT', 'EMERGENCY', 'HOLIDAY']);
const target = z
  .object({ roleName: z.enum(['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']).optional(), classId: uuid.optional() })
  .refine((t) => t.roleName || t.classId, 'A target needs a role or a class');

export const createNoticeSchema = z.object({
  schoolId: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  type: type.default('GENERAL'),
  publish: z.boolean().default(false),
  publishAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  targets: z.array(target).max(50).default([]),
});

export const updateNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10_000).optional(),
  type: type.optional(),
  publish: z.boolean().optional(),
  publishAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  targets: z.array(target).max(50).optional(),
});

export const listNoticesSchema = paginationSchema.extend({
  schoolId: uuid.optional(),
  type: type.optional(),
  status: z.enum(['published', 'draft', 'scheduled', 'expired']).optional(),
});
export const idParamSchema = z.object({ id: uuid });
