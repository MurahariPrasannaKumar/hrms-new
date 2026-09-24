import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const idParam = z.object({ id: z.string().uuid() });
const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const schoolId = z.string().uuid().optional(); // honoured only for SUPER_ADMIN

const listBase = paginationSchema.extend({ schoolId });

export const listYearsQuery = listBase;
export const listClassesQuery = listBase.extend({ academicYearId: uuid.optional() });
export const listSectionsQuery = listBase.extend({ classId: uuid.optional() });
export const listSubjectsQuery = listBase;
export const listExamsQuery = listBase.extend({ classId: uuid.optional(), subjectId: uuid.optional(), academicYearId: uuid.optional() });

export const createYearSchema = z
  .object({ schoolId, name, startDate: z.coerce.date(), endDate: z.coerce.date(), isCurrent: z.boolean().optional() })
  .refine((v) => v.endDate > v.startDate, { message: 'endDate must be after startDate', path: ['endDate'] });
export const updateYearSchema = z
  .object({ name, startDate: z.coerce.date(), endDate: z.coerce.date(), isCurrent: z.boolean() })
  .partial();

export const createClassSchema = z.object({ schoolId, academicYearId: uuid, name, level: z.number().int().min(0).max(30).optional() });
export const updateClassSchema = z.object({ name, level: z.number().int().min(0).max(30) }).partial();

export const createSectionSchema = z.object({ classId: uuid, name });
export const updateSectionSchema = z.object({ name }).partial();

export const createSubjectSchema = z.object({ schoolId, name, code: z.string().trim().min(1).max(20).toUpperCase() });
export const updateSubjectSchema = z.object({ name, code: z.string().trim().min(1).max(20).toUpperCase() }).partial();

export const createExamSchema = z.object({
  schoolId,
  academicYearId: uuid, classId: uuid, subjectId: uuid, name,
  date: z.coerce.date(), maxMarks: z.number().int().min(1).max(1000).optional(),
});
export const updateExamSchema = z.object({ name, date: z.coerce.date(), maxMarks: z.number().int().min(1).max(1000) }).partial();

export const putResultsSchema = z.object({
  results: z.array(z.object({ studentId: uuid, marks: z.number().min(0), grade: z.string().trim().max(5).optional() })).min(1).max(500),
});

export type ListQuery = z.infer<typeof listBase>;

export const notifyClassSchema = z.object({
  sectionId: uuid.optional(),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
});
