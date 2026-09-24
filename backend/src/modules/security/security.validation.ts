import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const date = z.coerce.date();

export const auditLogQuerySchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  resource: z.string().trim().optional(),
  schoolId: z.string().uuid().optional(),
  from: date.optional(),
  to: date.optional(),
});

export const loginActivityQuerySchema = paginationSchema.extend({
  success: z.enum(['true', 'false']).optional(),
  from: date.optional(),
  to: date.optional(),
});

export const sessionQuerySchema = paginationSchema.extend({ userId: z.string().uuid().optional() });
export const idParamSchema = z.object({ id: z.string().uuid() });
