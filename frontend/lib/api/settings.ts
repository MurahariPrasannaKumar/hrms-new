import { http, unwrap } from "./client";

export interface SystemSettings {
  platformName: string;
  supportEmail: string;
  defaultLocale: string;
  maintenanceMode: boolean;
}

export interface SchoolProfile {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  principal: string | null;
  establishedYear: number | null;
  logoUrl: string | null;
}

export interface SchoolSettings {
  schoolId: string;
  profile: SchoolProfile;
  timezone: string;
  locale: string;
}

export type SchoolSettingsInput = {
  timezone: string;
  locale: string;
  profile: Partial<Omit<SchoolProfile, "id" | "code">>;
};

export const settingsApi = {
  getSystem: () => unwrap<SystemSettings>(http.get("/settings/system")),
  saveSystem: (b: SystemSettings) => unwrap<SystemSettings>(http.put("/settings/system", b)),
  getSchool: () => unwrap<SchoolSettings>(http.get("/settings/school")),
  saveSchool: (b: SchoolSettingsInput) => unwrap<SchoolSettings>(http.put("/settings/school", b)),
};
