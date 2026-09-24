import { cleanParams, http, unwrap, unwrapPage, type ListParams } from "./client";

export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface Ref { id: string; name: string }
export interface StudentRow {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  email: string | null;
  phone: string | null;
  status: StudentStatus;
  classId: string | null;
  sectionId: string | null;
  class: Ref | null;
  section: Ref | null;
  parent: { id: string; user: { firstName: string; lastName: string } } | null;
}
export interface StudentDetail extends Omit<StudentRow, "parent" | "class"> {
  dateOfBirth: string | null;
  admissionDate: string | null;
  address: string | null;
  parentId: string | null;
  class: (Ref & { level: number | null }) | null;
  parent: { id: string; phone: string | null; user: { firstName: string; lastName: string; email: string; phone: string | null } } | null;
  attendance: {
    PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number; total: number; percentage: number;
    recent: { id: string; status: AttendanceStatus; remark: string | null; attendance: { date: string } }[];
  };
  results: { id: string; marks: number; grade: string | null; exam: { name: string; date: string; maxMarks: number; subject?: { name: string } } }[];
  assignments: { id: string; title: string; dueDate: string | null; subject: { name: string } | null }[];
}
export interface StudentInput {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  address?: string;
  parentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  admissionDate?: string;
  status?: StudentStatus;
}

export interface TeacherRow {
  id: string;
  employeeId: string;
  phone: string | null;
  qualification: string | null;
  joiningDate: string | null;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; status: string; lastLoginAt: string | null };
  subjects: { subject: { id: string; name: string; code: string } }[];
  _count: { classes: number };
}
export interface TeacherDetail extends Omit<TeacherRow, "_count"> {
  classes: { classId: string; sectionId: string; class: Ref; section: Ref }[];
  workload: { subjects: number; sections: number; students: number; assignments: number; diaryEntries: number };
}
export interface TeacherCreate {
  email: string; password: string; firstName: string; lastName: string; employeeId: string;
  phone?: string; qualification?: string; joiningDate?: string;
}

export interface YearRow { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }
export interface SectionRef { id: string; name: string; _count: { students: number } }
export interface ClassRow { id: string; name: string; level: number | null; academicYearId: string; academicYear: Ref; sections: SectionRef[]; _count: { students: number } }
export interface SubjectRow { id: string; name: string; code: string }
export interface ExamRow { id: string; name: string; date: string; maxMarks: number; classId: string; subjectId: string; academicYearId: string; class?: Ref; subject?: Ref }
export interface ExamResults {
  exam: ExamRow;
  results: { id: string; studentId: string; marks: number; grade: string | null; student: { firstName: string; lastName: string; admissionNumber: string } }[];
}

export interface RosterStudent { id: string; firstName: string; lastName: string; admissionNumber: string; status: AttendanceStatus; remark: string | null }
export interface AttendanceSummary { month: string | null; counts: Record<AttendanceStatus, number>; total: number; percentage: number }
export interface AttendanceEntry {
  id: string; status: AttendanceStatus; remark: string | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  attendance: { id: string; date: string; sectionId: string };
}

function resource<Row, Input, Update = Partial<Input>>(base: string) {
  return {
    list: (params?: ListParams) => unwrapPage<Row>(http.get(base, { params: cleanParams(params) })),
    create: (body: Input) => unwrap<unknown>(http.post(base, body)),
    update: (id: string, body: Update) => unwrap<unknown>(http.patch(`${base}/${id}`, body)),
    remove: (id: string) => unwrap<unknown>(http.delete(`${base}/${id}`)),
  };
}

export const studentsApi = {
  ...resource<StudentRow, StudentInput>("/students"),
  get: (id: string) => unwrap<StudentDetail>(http.get(`/students/${id}`)),
};

export const teachersApi = {
  ...resource<TeacherRow, TeacherCreate, Partial<Omit<TeacherCreate, "email" | "password">> & { status?: string }>("/teachers"),
  get: (id: string) => unwrap<TeacherDetail>(http.get(`/teachers/${id}`)),
  setSubjects: (id: string, subjectIds: string[]) => unwrap<unknown>(http.put(`/teachers/${id}/subjects`, { subjectIds })),
  setClasses: (id: string, assignments: { classId: string; sectionId: string }[]) =>
    unwrap<unknown>(http.put(`/teachers/${id}/classes`, { assignments })),
};

export const academicsApi = {
  years: resource<YearRow, Omit<YearRow, "id" | "isCurrent"> & { isCurrent?: boolean }>("/academic-years"),
  classes: resource<ClassRow, { academicYearId: string; name: string; level?: number }>("/classes"),
  sections: resource<SectionRef, { classId: string; name: string }>("/sections"),
  subjects: resource<SubjectRow, { name: string; code: string }>("/subjects"),
  exams: resource<ExamRow, { academicYearId: string; classId: string; subjectId: string; name: string; date: string; maxMarks?: number }>("/exams"),
  results: (examId: string) => unwrap<ExamResults>(http.get(`/exams/${examId}/results`)),
  saveResults: (examId: string, results: { studentId: string; marks: number; grade?: string }[]) =>
    unwrap<unknown>(http.put(`/exams/${examId}/results`, { results })),
};

export const attendanceRosterApi = {
  roster: (sectionId: string, date: string) =>
    unwrap<{ sectionId: string; date: string; students: RosterStudent[] }>(http.get("/attendance/section-roster", { params: { sectionId, date } })),
  mark: (sectionId: string, date: string, records: { studentId: string; status: AttendanceStatus }[]) =>
    unwrap<unknown>(http.post("/attendance", { sectionId, date, records })),
  summary: (params: { sectionId?: string; studentId?: string; month?: string }) =>
    unwrap<AttendanceSummary>(http.get("/attendance/summary", { params: cleanParams(params) })),
  list: (params: ListParams) => unwrapPage<AttendanceEntry>(http.get("/attendance", { params: cleanParams(params) })),
};

export const parentsApi = {
  list: (search?: string) => unwrap<{ id: string; name: string; email: string }[]>(http.get("/parents", { params: { search: search || undefined } })),
};
