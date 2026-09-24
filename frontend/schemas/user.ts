import { z } from "zod";
import { passwordRule } from "./auth";

export const ROLE_OPTIONS = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT", "STAFF"] as const;
export const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

/** Permissions an admin can grant on top of a STAFF user's role. */
export const STAFF_PERMISSION_OPTIONS = [
  "students.read", "students.update", "teachers.read", "attendance.read", "attendance.create",
  "notices.read", "notices.create", "academics.read", "reports.read", "diary.read",
] as const;

const base = {
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(ROLE_OPTIONS),
  schoolId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  status: z.enum(STATUS_OPTIONS),
  extraPermissions: z.array(z.string()),
};

const needsSchool = (v: { role: string; schoolId?: string }) => v.role === "SUPER_ADMIN" || !!v.schoolId;
const schoolMsg = { message: "Select a school for this role", path: ["schoolId"] };

export const createUserFormSchema = z.object({ ...base, password: passwordRule }).refine(needsSchool, schoolMsg);
export const editUserFormSchema = z.object(base).refine(needsSchool, schoolMsg);

export type CreateUserValues = z.infer<typeof createUserFormSchema>;
export type EditUserValues = z.infer<typeof editUserFormSchema>;

export const setPasswordSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
export type SetPasswordValues = z.infer<typeof setPasswordSchema>;
