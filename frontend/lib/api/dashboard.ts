import { http, unwrap } from "./client";

export interface AttendanceSummary {
  percent: number | null;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}
export interface TrendPoint { date: string; presentPct: number | null; total: number }
export interface MonthPoint { month: string; count: number }
export interface NoticeBrief { id: string; title: string; type: string; createdAt: string }
export interface DiaryBrief { id: string; title: string; isHomework: boolean; dueDate: string | null; createdAt: string }
export interface ActivityRow {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  schoolId: string | null;
  user: string | null;
  createdAt: string;
}

export interface AdminDashboard {
  stats: {
    totalSchools: number; activeSchools: number; totalStudents: number; totalTeachers: number;
    totalStaff: number; activeUsers: number; attendanceTodayPct: number | null; pendingActions: number;
  };
  charts: {
    studentGrowth: MonthPoint[];
    schoolGrowth: MonthPoint[];
    attendanceTrend: TrendPoint[];
    userActivity: { date: string; logins: number }[];
    moduleUsage: { module: string; key: string; schools: number }[];
  };
  recentActivity: ActivityRow[];
}

export interface SchoolDashboard {
  stats: { totalStudents: number; totalTeachers: number; totalClasses: number; attendanceTodayPct: number | null; pendingAssignments: number };
  recentNotices: NoticeBrief[];
  upcomingEvents: { id: string; title: string; type: string; publishAt: string | null; expiresAt: string | null }[];
  academicPerformance: { averagePct: number | null; bySubject: { subject: string; averagePct: number | null }[] };
  charts: {
    attendanceTrend: TrendPoint[];
    studentDistribution: { class: string; count: number }[];
    classPerformance: { class: string; averagePct: number | null }[];
  };
  recentActivity: ActivityRow[];
}

export interface TeacherDashboard {
  stats: { assignedClasses: number; totalStudents: number; pendingAssignments: number; attendancePending: number };
  classes: { classId: string; className: string; sectionId: string; sectionName: string; studentCount: number; attendanceMarkedToday: boolean }[];
  charts: { attendanceTrend: TrendPoint[] };
  recentDiary: DiaryBrief[];
  recentNotices: NoticeBrief[];
}

export interface StudentDashboard {
  student: { id: string; name: string; admissionNumber: string; classId: string | null; className: string | null; sectionId: string | null; sectionName: string | null };
  attendance: AttendanceSummary;
  performance: {
    averagePct: number | null;
    byClass: { class: string; averagePct: number | null }[];
    bySubject: { subject: string; averagePct: number | null }[];
    recent: { exam: string; subject: string; marks: number; maxMarks: number; pct: number }[];
  };
  upcomingAssignments: { id: string; title: string; dueDate: string | null; subject: string; submitted: boolean }[];
  recentDiary: DiaryBrief[];
  recentNotices: NoticeBrief[];
  learning: { completedLessons: number; totalLessons: number; progressPct: number | null };
}

export interface ParentDashboard {
  children: {
    id: string; name: string; admissionNumber: string; classId: string | null; className: string | null;
    sectionId: string | null; sectionName: string | null; attendance: AttendanceSummary;
    averagePct: number | null; upcomingAssignments: number;
  }[];
  recentNotices: NoticeBrief[];
}

const get = <T,>(kind: string) => unwrap<T>(http.get(`/dashboard/${kind}`));

export const dashboardApi = {
  admin: () => get<AdminDashboard>("admin"),
  school: () => get<SchoolDashboard>("school"),
  teacher: () => get<TeacherDashboard>("teacher"),
  student: () => get<StudentDashboard>("student"),
  parent: () => get<ParentDashboard>("parent"),
};
