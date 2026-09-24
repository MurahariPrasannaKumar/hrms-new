import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';
import { passwordRule } from '../auth/auth.validation';

const status = z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED']);
const gender = z.enum(['MALE', 'FEMALE', 'OTHER']);
const optStr = z.string().trim().min(1).optional();

export const idParam = z.object({ id: z.string().uuid() });

export const listStudentsQuery = paginationSchema.extend({
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  status: status.optional(),
  schoolId: z.string().uuid().optional(),
});

export const createStudentSchema = z.object({
  schoolId: z.string().uuid().optional(), // honoured only for SUPER_ADMIN
  admissionNumber: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  dateOfBirth: z.coerce.date().optional(),
  gender: gender.optional(),
  email: z.string().trim().email().optional(),
  phone: optStr,
  address: optStr,
  parentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  admissionDate: z.coerce.date().optional(),
  status: status.optional(),
  profileImageUrl: z.string().url().optional(),
  login: z.object({ email: z.string().trim().email().toLowerCase(), password: passwordRule }).optional(),
});

export const updateStudentSchema = createStudentSchema
  .omit({ schoolId: true, login: true })
  .partial()
  .extend({
    parentId: z.string().uuid().nullable().optional(),
    classId: z.string().uuid().nullable().optional(),
    sectionId: z.string().uuid().nullable().optional(),
  });

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuery>;
