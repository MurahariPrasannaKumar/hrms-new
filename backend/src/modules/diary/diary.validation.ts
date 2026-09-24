import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const uuid = z.string().uuid();

export const createDiarySchema = z.object({
  schoolId: uuid.optional(),
  teacherId: uuid.optional(), // only needed when an admin (no teacher profile) writes an entry
  classId: uuid,
  sectionId: uuid.optional(),
  subjectId: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  isHomework: z.boolean().default(false),
  dueDate: z.coerce.date().optional(),
  fileId: uuid.optional(),
});
export const updateDiarySchema = createDiarySchema
  .omit({ schoolId: true, teacherId: true, classId: true, sectionId: true })
  .extend({ dueDate: z.coerce.date().nullable().optional(), fileId: uuid.nullable().optional() })
  .partial();

export const listDiarySchema = paginationSchema.extend({
  schoolId: uuid.optional(),
  classId: uuid.optional(),
  sectionId: uuid.optional(),
  subjectId: uuid.optional(),
  isHomework: z.enum(['true', 'false']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createAssignmentSchema = z.object({
  schoolId: uuid.optional(),
  teacherId: uuid.optional(),
  classId: uuid,
  subjectId: uuid,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).optional(),
  dueDate: z.coerce.date().optional(),
  fileId: uuid.optional(),
  /** Send the class a platform notification + email. On by default. */
  notify: z.boolean().optional(),
});
export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  fileId: uuid.nullable().optional(),
});
export const listAssignmentsSchema = paginationSchema.extend({
  schoolId: uuid.optional(),
  classId: uuid.optional(),
  subjectId: uuid.optional(),
});

export const submitSchema = z
  .object({ content: z.string().max(10_000).optional(), fileId: uuid.optional() })
  .refine((v) => v.content || v.fileId, 'Provide content or a file');
export const gradeSchema = z.object({ marks: z.number().min(0).max(1000) });

export const idParamSchema = z.object({ id: uuid });
export const submissionParamSchema = z.object({ id: uuid, submissionId: uuid });
