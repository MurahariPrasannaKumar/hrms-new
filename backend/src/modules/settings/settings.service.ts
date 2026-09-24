import type { Request } from 'express';
import type { z } from 'zod';
import { prisma } from '../../config/database';
import { resolveSchoolId } from '../../middlewares/tenant';
import { ApiError } from '../../utils/ApiError';
import type { schoolSettingsSchema, SystemSettings } from './settings.validation';

const SYSTEM_KEY = 'platform';
const SYSTEM_DEFAULTS: SystemSettings = {
  platformName: 'EduSphere',
  supportEmail: '',
  defaultLocale: 'en',
  maintenanceMode: false,
};

const profileSelect = {
  id: true, name: true, code: true, email: true, phone: true, address: true, city: true,
  state: true, country: true, postalCode: true, principal: true, establishedYear: true, logoUrl: true,
} as const;

export const settingsService = {
  async getSystem(): Promise<SystemSettings> {
    const row = await prisma.systemSetting.findUnique({ where: { key: SYSTEM_KEY } });
    return { ...SYSTEM_DEFAULTS, ...((row?.value as Partial<SystemSettings> | undefined) ?? {}) };
  },

  async putSystem(value: SystemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: SYSTEM_KEY },
      update: { value },
      create: { key: SYSTEM_KEY, value },
    });
    return value;
  },

  async getSchool(req: Request, requestedSchoolId?: string) {
    const schoolId = resolveSchoolId(req, requestedSchoolId);
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { ...profileSelect, settings: { select: { timezone: true, locale: true } } },
    });
    if (!school) throw ApiError.notFound('School not found');
    const { settings, ...profile } = school;
    return { schoolId, profile, timezone: settings?.timezone ?? 'UTC', locale: settings?.locale ?? 'en' };
  },

  async putSchool(req: Request, requestedSchoolId: string | undefined, data: z.infer<typeof schoolSettingsSchema>) {
    const schoolId = resolveSchoolId(req, requestedSchoolId);
    if (!(await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } }))) throw ApiError.notFound('School not found');
    await prisma.$transaction(async (tx) => {
      if (data.profile && Object.keys(data.profile).length) await tx.school.update({ where: { id: schoolId }, data: data.profile });
      if (data.timezone || data.locale) {
        await tx.schoolSetting.upsert({
          where: { schoolId },
          update: { ...(data.timezone && { timezone: data.timezone }), ...(data.locale && { locale: data.locale }) },
          create: { schoolId, ...(data.timezone && { timezone: data.timezone }), ...(data.locale && { locale: data.locale }) },
        });
      }
    });
    return this.getSchool(req, schoolId);
  },
};
