import { z } from 'zod';
import { ROLES } from '../../config/permissions';
import { paginationSchema } from '../../utils/pagination';
import { passwordRule } from '../auth/auth.validation';

const role = z.enum(ROLES);
const status = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const createUserSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  username: z.string().trim().min(3).max(40).toLowerCase().optional(),
  password: passwordRule,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional().nullable(),
  role,
  schoolId: z.string().uuid().optional().nullable(), // honoured only for SUPER_ADMIN
  status: status.optional(),
  classId: z.string().uuid().optional().nullable(), // STUDENT placement
  sectionId: z.string().uuid().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().trim().email().toLowerCase().optional(),
  username: z.string().trim().min(3).max(40).toLowerCase().optional().nullable(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  role: role.optional(),
  schoolId: z.string().uuid().optional().nullable(),
  status: status.optional(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  extraPermissions: z.array(z.string()).optional(), // permission keys (configurable STAFF access)
});

export const listUsersSchema = paginationSchema.extend({
  role: role.optional(),
  status: status.optional(),
  schoolId: z.string().uuid().optional(),
});

export const setPasswordSchema = z.object({ password: passwordRule });

export const idParamSchema = z.object({ id: z.string().uuid() });
