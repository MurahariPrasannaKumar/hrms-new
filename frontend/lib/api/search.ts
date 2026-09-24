import { http, unwrap } from "./client";
import type { Role } from "@/lib/auth/types";
import { ROLE_AREA } from "@/lib/permissions/nav";

interface Raw {
  students: { id: string; firstName: string; lastName: string; admissionNumber: string }[];
  teachers: { id: string; employeeId: string; user: { firstName: string; lastName: string; email: string } }[];
  schools: { id: string; name: string; code: string; city: string | null }[];
  notices: { id: string; title: string; type: string }[];
  courses: { id: string; title: string; category: string | null }[];
  resources: { id: string; title: string; type: string; area: string; category: string | null }[];
}

export interface SearchHit { id: string; label: string; sub?: string; href: string }
export interface SearchGroup { key: keyof Raw; label: string; items: SearchHit[] }

const AREA_ROUTE: Record<string, string> = { "smart-class": "smart-class", pedagogy: "pedagogy", cmds: "cmds" };

/** Maps the categorized backend payload to clickable groups; hrefs point at the caller's own area. */
export function groupSearch(raw: Raw, role: Role): SearchGroup[] {
  const a = ROLE_AREA[role];
  const groups: SearchGroup[] = [
    { key: "students", label: "Students", items: raw.students.map((s) => ({ id: s.id, label: `${s.firstName} ${s.lastName}`, sub: s.admissionNumber, href: `${a}/students` })) },
    { key: "teachers", label: "Teachers", items: raw.teachers.map((t) => ({ id: t.id, label: `${t.user.firstName} ${t.user.lastName}`, sub: t.employeeId, href: `${a}/teachers` })) },
    { key: "schools", label: "Schools", items: raw.schools.map((s) => ({ id: s.id, label: s.name, sub: [s.code, s.city].filter(Boolean).join(" · "), href: `/admin/schools/${s.id}` })) },
    { key: "notices", label: "Notices", items: raw.notices.map((n) => ({ id: n.id, label: n.title, sub: n.type, href: `${a}/noticeboard` })) },
    { key: "courses", label: "Courses", items: raw.courses.map((c) => ({ id: c.id, label: c.title, sub: c.category ?? undefined, href: `${a}/learn` })) },
    { key: "resources", label: "Learning resources", items: raw.resources.map((r) => ({ id: r.id, label: r.title, sub: r.category ?? r.type, href: `${a}/${AREA_ROUTE[r.area] ?? "smart-class"}` })) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export const searchApi = {
  search: async (q: string, role: Role): Promise<SearchGroup[]> =>
    groupSearch(await unwrap<Raw>(http.get("/search", { params: { q } })), role),
};
