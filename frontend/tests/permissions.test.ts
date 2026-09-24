import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth/types";
import { filterNav, homeFor, isForeignArea, NAV_BY_ROLE, ROLE_HOME } from "@/lib/permissions";

const user = (over: Partial<AuthUser>): AuthUser => ({
  id: "1", email: "a@b.c", firstName: "A", lastName: "B", role: "STUDENT", schoolId: "s", permissions: [], school: null, modules: [], ...over,
});

describe("role routing", () => {
  it("maps every role to its dashboard", () => {
    expect(ROLE_HOME).toEqual({
      SUPER_ADMIN: "/admin/dashboard", SCHOOL_ADMIN: "/school/dashboard", TEACHER: "/teacher/dashboard",
      STUDENT: "/student/dashboard", PARENT: "/parent/dashboard", STAFF: "/staff/dashboard",
    });
    expect(homeFor("TEACHER")).toBe("/teacher/dashboard");
  });

  it("detects another role's area", () => {
    expect(isForeignArea("TEACHER", "/admin/schools")).toBe(true);
    expect(isForeignArea("TEACHER", "/teacher/students")).toBe(false);
    expect(isForeignArea("TEACHER", "/login")).toBe(false);
  });
});

describe("permission-filtered nav", () => {
  const perms = ["academics.read", "attendance.read", "notices.read", "learning.read", "ai.use", "diary.read"];

  it("hides items lacking the permission", () => {
    const labels = filterNav(NAV_BY_ROLE.STUDENT, user({ permissions: ["attendance.read"], modules: ["dashboard", "attendance", "academics"] })).map((i) => i.label);
    expect(labels).toEqual(["Dashboard", "Attendance"]);
  });

  it("hides items whose module is disabled for the school", () => {
    const modules = ["dashboard", "academics", "attendance", "diary", "noticeboard", "learn", "smart-class", "v-buddy"]; // instasolve off
    const labels = filterNav(NAV_BY_ROLE.STUDENT, user({ permissions: perms, modules })).map((i) => i.label);
    expect(labels).toContain("V Buddy");
    expect(labels).not.toContain("Instasolve");
  });

  it("super admin nav is driven by permissions only", () => {
    const labels = filterNav(NAV_BY_ROLE.SUPER_ADMIN, user({ role: "SUPER_ADMIN", permissions: ["schools.read", "users.read"] })).map((i) => i.label);
    expect(labels).toEqual(["Dashboard", "Schools", "Users"]);
  });
});
