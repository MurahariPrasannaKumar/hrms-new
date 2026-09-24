import { cleanParams, http, toApiError, unwrap, unwrapPage, type ListParams } from "./client";
import { crudApi } from "./resources";

export interface SchoolRow {
  id: string;
  name: string;
  code: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  principal?: string | null;
  establishedYear?: number | null;
  logoUrl?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  _count?: { students?: number; teachers?: number; staff?: number; users?: number; classes?: number };
}

export interface UserRow {
  id: string;
  email: string;
  username?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  lastLoginAt?: string | null;
  createdAt: string;
  schoolId?: string | null;
  role: { id: string; name: string };
  school?: { id: string; name: string; code: string } | null;
  extraPermissions?: { permission: { key: string } }[];
  student?: { classId: string | null; sectionId: string | null; class?: { id: string; name: string; level: number | null } | null; section?: { id: string; name: string } | null } | null;
}

export interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface LoginAttemptRow {
  id: string;
  email: string;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface SessionRow {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastSeenAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export interface ModuleRow {
  key: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  schoolEnabled?: boolean;
}

export const adminSchoolApi = crudApi<SchoolRow, Record<string, unknown>, Record<string, unknown>>("/schools");

const users = crudApi<UserRow, Record<string, unknown>, Record<string, unknown>>("/users");
export const adminUserApi = {
  ...users,
  setPassword: (id: string, password: string) => unwrap<null>(http.post(`/users/${id}/reset-password`, { password })),
  destroy: (id: string) => unwrap<null>(http.delete(`/users/${id}/permanent`)),
};

export const modulesApi = {
  list: (schoolId?: string) => unwrap<ModuleRow[]>(http.get("/modules", { params: cleanParams({ schoolId }) })),
  setPlatform: (key: string, enabled: boolean) => unwrap<unknown>(http.patch(`/modules/${key}`, { enabled })),
  setSchool: (schoolId: string, key: string, enabled: boolean) =>
    unwrap<unknown>(http.put(`/modules/school/${schoolId}/${key}`, { enabled })),
};

export const securityApi = {
  auditLogs: (p?: ListParams) => unwrapPage<AuditLogRow>(http.get("/security/audit-logs", { params: cleanParams(p) })),
  loginActivity: (p?: ListParams) => unwrapPage<LoginAttemptRow>(http.get("/security/login-activity", { params: cleanParams(p) })),
  failedLogins: (p?: ListParams) => unwrapPage<LoginAttemptRow>(http.get("/security/failed-logins", { params: cleanParams(p) })),
  sessions: (p?: ListParams) => unwrapPage<SessionRow>(http.get("/security/sessions", { params: cleanParams(p) })),
  revokeSession: (id: string) => unwrap<unknown>(http.delete(`/security/sessions/${id}`)),
};

export const REPORT_TYPES = [
  { value: "student-attendance", label: "Student attendance" },
  { value: "teacher-attendance", label: "Teacher attendance" },
  { value: "academic-performance", label: "Academic performance" },
  { value: "enrollment", label: "Student enrollment" },
  { value: "school-statistics", label: "School statistics" },
  { value: "user-activity", label: "User activity" },
] as const;

export interface ReportResult {
  type: string;
  rows: Record<string, unknown>[];
  note?: string;
}

export const reportsApi = {
  run: (type: string, p?: ListParams) => unwrap<ReportResult>(http.get(`/reports/${type}`, { params: cleanParams(p) })),
  /** Downloads CSV through the authenticated axios client (a plain <a href> would lack the bearer token). */
  async downloadCsv(type: string, p?: ListParams) {
    try {
      const res = await http.get(`/reports/${type}`, { params: cleanParams({ ...p, format: "csv" }), responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      throw toApiError(e);
    }
  },
};

/** Generic list fetch for the school-detail tabs (?schoolId= scoped). */
export const listFor = (path: string, params?: ListParams) => unwrapPage<Record<string, unknown>>(http.get(path, { params: cleanParams(params) }));
