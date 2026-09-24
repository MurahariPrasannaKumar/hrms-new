import { z } from 'zod';

export const systemSettingsSchema = z.object({
  platformName: z.string().trim().min(2).max(80),
  supportEmail: z.string().trim().email().max(255).or(z.literal('')),
  defaultLocale: z.string().trim().min(2).max(10),
  maintenanceMode: z.boolean(),
});
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

const opt = z.string().trim().max(255).optional().nullable();

export const schoolSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(60).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
  profile: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
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
    })
    .optional(),
});

export const schoolScopeQuery = z.object({ schoolId: z.string().uuid().optional() });
