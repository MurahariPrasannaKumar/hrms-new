import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: optionalText(30),
  // student
  address: optionalText(300),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  // teacher
  qualification: optionalText(200),
});

export const teachingClassesSchema = z.object({ classIds: z.array(z.string().uuid()).max(100) });
