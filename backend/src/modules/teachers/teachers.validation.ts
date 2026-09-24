import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';
import { passwordRule } from '../auth/auth.validation';

export const idParam = z.object({ id: z.string().uuid() });

export const listTeachersQuery = paginationSchema.extend({ schoolId: z.string().uuid().optional() });

export const createTeacherSchema = z.object({
  schoolId: z.string().uuid().optional(), // honoured only for SUPER_ADMIN
  email: z.string().trim().email().toLowerCase(),
  password: passwordRule,
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().min(1).optional(),
  employeeId: z.string().trim().min(1),
  qualification: z.string().trim().min(1).optional(),
  joiningDate: z.coerce.date().optional(),
});

export const updateTeacherSchema = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    employeeId: z.string().trim().min(1),
    qualification: z.string().trim().min(1),
    joiningDate: z.coerce.date(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  })
  .partial();

export const setSubjectsSchema = z.object({ subjectIds: z.array(z.string().uuid()).max(100) });
export const setClassesSchema = z.object({
  assignments: z.array(z.object({ classId: z.string().uuid(), sectionId: z.string().uuid() })).max(200),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type ListTeachersQuery = z.infer<typeof listTeachersQuery>;
