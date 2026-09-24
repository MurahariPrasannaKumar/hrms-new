export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "STAFF";

export interface SchoolInfo {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  schoolId: string | null;
  permissions: string[];
  school: SchoolInfo | null;
  modules: string[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  mustChangePassword?: boolean;
}
