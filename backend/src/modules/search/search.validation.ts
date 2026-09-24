import { z } from 'zod';

export const searchSchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  limit: z.coerce.number().int().min(1).max(10).default(5),
  schoolId: z.string().uuid().optional(),
});
