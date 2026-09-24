import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const uuid = z.string().uuid();

export const studentsQuerySchema = paginationSchema.extend({
  schoolId: uuid.optional(),
  classId: uuid.optional(),
  sectionId: uuid.optional(),
  risk: z.enum(['ok', 'watch', 'at_risk']).optional(),
});
export const teachersQuerySchema = paginationSchema.extend({ schoolId: uuid.optional() });
export const summaryQuerySchema = z.object({ schoolId: uuid.optional(), classId: uuid.optional(), sectionId: uuid.optional() });
export const detailQuerySchema = z.object({ schoolId: uuid.optional(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });
export const idParamSchema = z.object({ id: uuid });
