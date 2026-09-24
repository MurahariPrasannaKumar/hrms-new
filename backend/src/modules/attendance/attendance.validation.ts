import { z } from 'zod';
import { dateOnlyString, toUtcDate } from '../../utils/actor';
import { paginationSchema } from '../../utils/pagination';

const dateOnly = z.string().regex(dateOnlyString, 'Use YYYY-MM-DD').transform(toUtcDate);
const status = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);
const uuid = z.string().uuid();

export const markAttendanceSchema = z.object({
  schoolId: uuid.optional(),
  sectionId: uuid,
  date: dateOnly,
  records: z
    .array(z.object({ studentId: uuid, status, remark: z.string().max(255).optional() }))
    .min(1)
    .max(500),
});

export const listAttendanceSchema = paginationSchema.extend({
  schoolId: uuid.optional(),
  sectionId: uuid.optional(),
  classId: uuid.optional(),
  studentId: uuid.optional(),
  status: status.optional(),
  date: dateOnly.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const rosterSchema = z.object({ schoolId: uuid.optional(), sectionId: uuid, date: dateOnly });

export const summarySchema = z.object({
  schoolId: uuid.optional(),
  studentId: uuid.optional(),
  sectionId: uuid.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM').optional(),
});

export const updateRecordSchema = z
  .object({ status: status.optional(), remark: z.string().max(255).nullable().optional() })
  .refine((v) => v.status !== undefined || v.remark !== undefined, 'Nothing to update');

export const idParamSchema = z.object({ id: uuid });

export const meSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM').optional(),
  studentId: uuid.optional(),
});
