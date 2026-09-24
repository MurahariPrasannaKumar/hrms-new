import { z } from 'zod';
import { dateOnlyString, toUtcDate } from '../../utils/actor';

const dateOnly = z.string().regex(dateOnlyString, 'Use YYYY-MM-DD').transform(toUtcDate);

export const REPORT_TYPES = [
  'student-attendance', 'teacher-attendance', 'academic-performance', 'enrollment', 'school-statistics', 'user-activity',
] as const;

export const reportParamSchema = z.object({ type: z.enum(REPORT_TYPES) });
export const reportQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
