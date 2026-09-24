import {
  BarChart3, Bell, BookOpen, Bot, Boxes, CalendarCheck, ClipboardList, FileClock, GraduationCap, LayoutDashboard,
  Lightbulb, type LucideIcon, Megaphone, MonitorPlay, NotebookPen, School, Settings, ShieldCheck, Sparkles,
  UserCog, Users, Library, Baby, TrendingUp, CalendarOff,
} from "lucide-react";
import type { AuthUser, Role } from "@/lib/auth/types";

export type Tint = "indigo" | "teal" | "amber" | "rose" | "sky" | "violet" | "emerald" | "orange";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tint: Tint;
  permission?: string;
  moduleKey?: string;
}

export const TINT_CLASSES: Record<Tint, string> = {
  indigo: "bg-orange-100/70 text-orange-800",
  teal: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-800",
  rose: "bg-rose-50 text-rose-800",
  sky: "bg-sky-50 text-sky-800",
  violet: "bg-purple-50 text-purple-800",
  emerald: "bg-lime-50 text-lime-900",
  orange: "bg-orange-50 text-orange-800",
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  SCHOOL_ADMIN: "/school/dashboard",
  TEACHER: "/teacher/dashboard",
  STUDENT: "/student/dashboard",
  PARENT: "/parent/dashboard",
  STAFF: "/staff/dashboard",
};

export const ROLE_AREA: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  SCHOOL_ADMIN: "/school",
  TEACHER: "/teacher",
  STUDENT: "/student",
  PARENT: "/parent",
  STAFF: "/staff",
};

const item = (
  label: string, href: string, icon: LucideIcon, tint: Tint, permission?: string, moduleKey?: string,
): NavItem => ({ label, href, icon, tint, permission, moduleKey });

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    item("Dashboard", "/admin/dashboard", LayoutDashboard, "indigo"),
    item("Schools", "/admin/schools", School, "teal", "schools.read"),
    item("Users", "/admin/users", Users, "sky", "users.read"),
    item("Modules", "/admin/modules", Boxes, "violet", "modules.manage"),
    item("Analytics", "/admin/reports", BarChart3, "amber", "reports.read"),
    item("Progress", "/admin/progress", TrendingUp, "sky", "reports.read"),
    item("Security", "/admin/security", ShieldCheck, "rose", "security.read"),
    item("Noticeboard", "/admin/notices", Megaphone, "orange", "notices.read"),
    item("Leave", "/admin/leave", CalendarOff, "rose", "leave.manage"),
    item("Audit Logs", "/admin/audit-logs", FileClock, "orange", "audit_logs.read"),
    item("Settings", "/admin/settings", Settings, "emerald", "settings.manage"),
  ],
  SCHOOL_ADMIN: [
    item("Dashboard", "/school/dashboard", LayoutDashboard, "indigo", undefined, "dashboard"),
    item("Academics", "/school/academics", BookOpen, "teal", "academics.read", "academics"),
    item("Students", "/school/students", GraduationCap, "sky", "students.read", "student"),
    item("Teachers", "/school/teachers", UserCog, "violet", "teachers.read", "school"),
    item("Attendance", "/school/attendance", CalendarCheck, "emerald", "attendance.read", "attendance"),
    item("Progress", "/school/progress", TrendingUp, "sky", "reports.read"),
    item("Digital Diary", "/school/diary", NotebookPen, "amber", "diary.read", "diary"),
    item("Pedagogy", "/school/pedagogy", Lightbulb, "rose", "learning.read", "pedagogy"),
    item("Leave", "/school/leave", CalendarOff, "rose", "leave.manage"),
    item("Noticeboard", "/school/notices", Megaphone, "orange", "notices.read", "noticeboard"),
    item("Security", "/school/security", ShieldCheck, "rose", "security.read", "security"),
    item("Reports", "/school/reports", BarChart3, "indigo", "reports.read"),
    item("Settings", "/school/settings", Settings, "teal", "settings.manage"),
  ],
  TEACHER: [
    item("Dashboard", "/teacher/dashboard", LayoutDashboard, "indigo", undefined, "dashboard"),
    item("My Classes", "/teacher/classes", BookOpen, "teal", "academics.read", "academics"),
    item("Students", "/teacher/students", GraduationCap, "sky", "students.read", "student"),
    item("Attendance", "/teacher/attendance", CalendarCheck, "emerald", "attendance.read", "attendance"),
    item("Progress", "/teacher/progress", TrendingUp, "sky", "reports.read"),
    item("Assignments", "/teacher/assignments", ClipboardList, "violet", "assignments.read"),
    item("Digital Diary", "/teacher/diary", NotebookPen, "amber", "diary.read", "diary"),
    item("Pedagogy", "/teacher/pedagogy", Lightbulb, "rose", "learning.read", "pedagogy"),
    item("Smart Class", "/teacher/smart-class", MonitorPlay, "sky", "learning.read", "smart-class"),
    item("Leave", "/teacher/leave", CalendarOff, "rose", "leave.apply"),
    item("Noticeboard", "/teacher/notices", Megaphone, "orange", "notices.read", "noticeboard"),
  ],
  STUDENT: [
    item("Dashboard", "/student/dashboard", LayoutDashboard, "indigo", undefined, "dashboard"),
    item("Academics", "/student/academics", BookOpen, "teal", "academics.read", "academics"),
    item("Attendance", "/student/attendance", CalendarCheck, "emerald", "attendance.read", "attendance"),
    item("Digital Diary", "/student/diary", NotebookPen, "amber", "diary.read", "diary"),
    item("Noticeboard", "/student/notices", Megaphone, "orange", "notices.read", "noticeboard"),
    item("Pedagogy", "/student/pedagogy", Lightbulb, "amber", "learning.read", "pedagogy"),
    item("Learn 2.0", "/student/learn", Library, "violet", "learning.read", "learn"),
    item("Instasolve", "/student/instasolve", Sparkles, "rose", "ai.use", "instasolve"),
    item("Smart Class", "/student/smart-class", MonitorPlay, "sky", "learning.read", "smart-class"),
    item("V Buddy", "/student/v-buddy", Bot, "teal", "ai.use", "v-buddy"),
  ],
  PARENT: [
    item("Dashboard", "/parent/dashboard", LayoutDashboard, "indigo", undefined, "dashboard"),
    item("My Children", "/parent/children", Baby, "sky", "students.read", "student"),
    item("Attendance", "/parent/attendance", CalendarCheck, "emerald", "attendance.read", "attendance"),
    item("Academics", "/parent/academics", BookOpen, "teal", "academics.read", "academics"),
    item("Digital Diary", "/parent/diary", NotebookPen, "amber", "diary.read", "diary"),
    item("Noticeboard", "/parent/notices", Megaphone, "orange", "notices.read", "noticeboard"),
  ],
  STAFF: [
    item("Dashboard", "/staff/dashboard", LayoutDashboard, "indigo", undefined, "dashboard"),
    item("Students", "/staff/students", GraduationCap, "sky", "students.read", "student"),
    item("Attendance", "/staff/attendance", CalendarCheck, "emerald", "attendance.read", "attendance"),
    item("Leave", "/staff/leave", CalendarOff, "rose", "leave.apply"),
    item("Noticeboard", "/staff/notices", Megaphone, "orange", "notices.read", "noticeboard"),
  ],
};

export const NOTIFICATION_ICON = Bell;

/** Nav entries the user may see: permission granted AND module enabled for their school. */
export function filterNav(items: NavItem[], user: Pick<AuthUser, "permissions" | "modules">): NavItem[] {
  return items.filter(
    (i) => (!i.permission || user.permissions.includes(i.permission)) && (!i.moduleKey || user.modules.includes(i.moduleKey)),
  );
}

export const navForUser = (user: AuthUser) => filterNav(NAV_BY_ROLE[user.role], user);
