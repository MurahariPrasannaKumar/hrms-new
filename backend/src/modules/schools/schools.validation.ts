import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const opt = z.string().trim().max(255).optional().nullable();

export const createSchoolSchema = z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(30).toUpperCase(),
  email: z.string().trim().email().optional().nullable(),
  phone: opt,
  address: opt,
  city: opt,
  state: opt,
  country: opt,
  postalCode: opt,
  principal: opt,
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  logoUrl: opt,
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateSchoolSchema = createSchoolSchema.partial();

export const listSchoolsSchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  city: z.string().trim().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
