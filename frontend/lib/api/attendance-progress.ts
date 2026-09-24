import { cleanParams, http, unwrap, unwrapPage, type ListParams } from "./client";
import type { AttendanceStatus } from "./people";

export interface TodayState {
  date: string;
  marked: boolean;
  status: AttendanceStatus | null;
  source?: "TEACHER" | "SELF" | null;
  checkedInAt: string | null;
  checkedInTime: string | null;
  canCheckIn: boolean;
  reason: string | null;
  /** Set when check-in is locked until the student has been active long enough. */
  lockedBy?: "usage" | null;
  activeSeconds?: number;
  requiredSeconds?: number;
}
export interface Overview {
  overall: { percentage: number; present: number; absent: number; late: number; excused: number; totalDays: number };
  month: { month: string; percentage: number; totalDays: number; days: { date: string; status: AttendanceStatus }[] };
  trend: { month: string; percentage: number | null; totalDays: number }[];
  streak: { current: number; longest: number };
}
export interface MyAttendance extends Overview {
  student: { id: string; name: string; class: string | null; section: string | null };
  children?: { id: string; name: string }[];
  timezone: string;
  today: TodayState;
}
export interface TeacherAttendanceOverview extends Overview {
  timezone: string;
  today: TodayState;
}

export const attendanceSelfApi = {
  me: (params?: { month?: string; studentId?: string }) => unwrap<MyAttendance>(http.get("/attendance/me", { params: cleanParams(params) })),
  checkIn: () => unwrap<{ status: AttendanceStatus; checkedInAt: string; date: string }>(http.post("/attendance/check-in")),
  teacherMe: (params?: { month?: string }) => unwrap<TeacherAttendanceOverview>(http.get("/attendance/teacher/me", { params: cleanParams(params) })),
  teacherCheckIn: () => unwrap<{ status: AttendanceStatus; checkedInAt: string; date: string }>(http.post("/attendance/teacher/check-in")),
};

export type Risk = "ok" | "watch" | "at_risk";

export interface StudentProgressRow {
  studentId: string;
  name: string;
  admissionNumber: string;
  class: string | null;
  section: string | null;
  attendancePct: number | null;
  avgExamPct: number | null;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  lessonsCompleted: number;
  riskLevel: Risk;
}
export interface ProgressSummary {
  totalStudents: number;
  risk: Record<Risk, number>;
  avgAttendancePct: number | null;
  avgExamPct: number | null;
  lowestAttendance: { studentId: string; name: string; class: string | null; section: string | null; attendancePct: number | null; riskLevel: Risk }[];
  highestAttendance: ProgressSummary["lowestAttendance"];
}
export interface StudentProgressDetail {
  student: { id: string; name: string; admissionNumber: string; class: string | null; section: string | null; parent: { name: string; email: string } | null };
  metrics: Omit<StudentProgressRow, "studentId" | "name" | "admissionNumber" | "class" | "section">;
  attendance: Overview;
  subjects: { subject: string; averagePct: number; exams: { name: string; date: string; marks: number; maxMarks: number; pct: number; grade: string | null }[] }[];
  assignments: { id: string; title: string; subject: string; dueDate: string | null; submitted: boolean; submittedAt: string | null; marks: number | null }[];
  learning: { lessonsCompleted: number; recent: { lesson: string; course: string; completedAt: string | null }[] };
}
export interface TeacherProgressRow {
  teacherId: string;
  name: string;
  email: string;
  employeeId: string;
  subjects: string[];
  classes: string[];
  lastActiveAt: string | null;
  attendancePct: number | null;
  daysAttendanceMarked30d: number;
  assignmentsCreated: number;
  diaryEntries30d: number;
  noticesPublished: number;
}
export interface TeacherProgressDetail {
  teacher: TeacherProgressRow;
  attendance: TeacherAttendanceOverview;
  recentAssignments: { id: string; title: string; class: string; subject: string; dueDate: string | null; createdAt: string; submissions: number }[];
  recentDiary: { id: string; title: string; class: string; isHomework: boolean; createdAt: string }[];
}

export const progressApi = {
  summary: (params?: ListParams) => unwrap<ProgressSummary>(http.get("/progress/summary", { params: cleanParams(params) })),
  students: (params?: ListParams) => unwrapPage<StudentProgressRow>(http.get("/progress/students", { params: cleanParams(params) })),
  student: (id: string, params?: ListParams) => unwrap<StudentProgressDetail>(http.get(`/progress/students/${id}`, { params: cleanParams(params) })),
  teachers: (params?: ListParams) => unwrapPage<TeacherProgressRow>(http.get("/progress/teachers", { params: cleanParams(params) })),
  teacher: (id: string, params?: ListParams) => unwrap<TeacherProgressDetail>(http.get(`/progress/teachers/${id}`, { params: cleanParams(params) })),
};
