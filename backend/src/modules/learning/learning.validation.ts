import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const idParamSchema = z.object({ id: z.string().uuid() });

const lessonInput = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(50_000).optional(),
  videoUrl: z.string().url().max(2000).optional(),
  sortOrder: z.number().int().min(0).default(0),
});
const moduleInput = z.object({
  title: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).default(0),
  lessons: z.array(lessonInput).max(200).default([]),
});

export const createCourseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().trim().max(100).optional(),
  published: z.boolean().default(true),
  schoolId: z.string().uuid().optional(), // honoured for SUPER_ADMIN only
  global: z.boolean().default(false), // SUPER_ADMIN only: platform-wide course
  modules: z.array(moduleInput).max(100).default([]),
});
export const updateCourseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  published: z.boolean().optional(),
});
export const listCoursesSchema = paginationSchema.extend({
  category: z.string().optional(),
  schoolId: z.string().uuid().optional(),
});

export const createPathSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  courseIds: z.array(z.string().uuid()).max(50).default([]),
});

const resourceType = z.enum(['VIDEO', 'PRESENTATION', 'DOCUMENT', 'INTERACTIVE', 'LESSON_PLAN', 'OTHER']);
const area = z.enum(['smart-class', 'pedagogy', 'cmds']);

export const createResourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: resourceType.default('DOCUMENT'),
  category: z.string().trim().max(100).optional(),
  area: area.default('smart-class'),
  fileId: z.string().uuid().optional(),
  url: z.string().url().max(2000).optional(),
  schoolId: z.string().uuid().optional(),
  global: z.boolean().default(false),
});
export const updateResourceSchema = createResourceSchema
  .omit({ schoolId: true, global: true })
  .partial();
export const listResourcesSchema = paginationSchema.extend({
  area: area.optional(),
  category: z.string().optional(),
  type: resourceType.optional(),
  schoolId: z.string().uuid().optional(),
});
export const categoriesQuerySchema = z.object({ area: area.optional() });
