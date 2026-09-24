import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });

export const forgotPasswordSchema = z.object({ email: z.string().trim().email().toLowerCase() });

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a number');

export const resetPasswordSchema = z.object({ token: z.string().min(10), password: strongPassword });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});

export const passwordRule = strongPassword;
