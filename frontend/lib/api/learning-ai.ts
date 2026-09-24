import { cleanParams, http, unwrap, unwrapPage, type ListParams } from "./client";

export type ResourceArea = "smart-class" | "pedagogy" | "cmds";
export type ResourceType = "VIDEO" | "PRESENTATION" | "DOCUMENT" | "INTERACTIVE" | "LESSON_PLAN" | "OTHER";
export type NoticeType = "GENERAL" | "ACADEMIC" | "EVENT" | "EMERGENCY" | "HOLIDAY";

export interface Named { id: string; name: string }
export interface ClassRow extends Named { sections: (Named & { _count?: { students: number } })[] }
export interface SubjectRow extends Named { code: string }

export interface DiaryRow {
  id: string; classId: string; sectionId: string | null; subjectId: string | null; title: string; body: string;
  isHomework: boolean; dueDate: string | null; createdAt: string; completed?: boolean;
  subject?: Named | null; class?: Named | null; section?: Named | null;
}
export interface DiaryInput {
  classId: string; sectionId?: string; subjectId?: string; title: string; body: string; isHomework: boolean; dueDate?: string;
}

export interface AssignmentRow {
  id: string; classId: string; subjectId: string; title: string; description: string | null; dueDate: string | null; fileId?: string | null;
  subject?: Named; class?: Named; teacher?: { user: { firstName: string; lastName: string } }; _count?: { submissions: number };
  /** Present for students: their own hand-in, or null if they have not submitted yet. */
  mySubmission?: { submittedAt: string; marks: number | null; content: string | null; fileId: string | null } | null;
}
export interface AssignmentInput { classId: string; subjectId: string; title: string; description?: string; dueDate?: string; fileId?: string; notify?: boolean }
export interface SubmissionRow {
  id: string; studentId: string; content: string | null; fileId: string | null; marks: number | null; submittedAt: string;
  student?: { firstName: string; lastName: string; admissionNumber?: string };
}

export interface NoticeTarget { roleName?: string; classId?: string }
export interface NoticeRow {
  id: string; title: string; body: string; type: NoticeType; isPublished: boolean;
  publishAt: string | null; expiresAt: string | null; createdAt: string; targets: NoticeTarget[];
}
export interface NoticeInput {
  title: string; body: string; type: NoticeType; publish: boolean; publishAt?: string; expiresAt?: string; targets: NoticeTarget[];
  /** Required for platform admins, who post on behalf of one school. */
  schoolId?: string;
}

export interface ResourceRow {
  id: string; title: string; description: string | null; type: ResourceType; category: string | null; area: ResourceArea;
  fileId: string | null; url: string | null; createdAt: string;
  classId?: string | null; class?: { id: string; name: string } | null;
  uploadedById?: string | null; uploadedBy?: { id: string; firstName: string; lastName: string } | null;
}
export interface ResourceInput {
  title: string; description?: string; type: ResourceType; category?: string; area: ResourceArea; fileId?: string; url?: string; classId?: string;
}

export interface CourseRow {
  id: string; title: string; description: string | null; category: string | null; moduleCount?: number; lessonCount?: number;
  completionPercent: number;
}
export interface LessonRow { id: string; title: string; content: string | null; videoUrl: string | null; completed?: boolean }
export interface CourseDetail extends CourseRow {
  modules: { id: string; title: string; lessons: LessonRow[] }[];
  completedLessons: number;
}
export interface PathRow { id: string; title: string; description: string | null; courses: { id: string; title: string }[]; completionPercent: number }
export interface CertificateRow { courseId: string; courseTitle: string; status: string }

export interface ConversationRow { id: string; title: string; updatedAt: string }
export interface ChatMessageRow { id: string; role: "user" | "assistant"; content: string; createdAt?: string }
export interface SolveResult { explanation: string; answer: string; relatedConcepts: string[]; steps: string[] }

const list = <T>(path: string, params?: ListParams) => unwrapPage<T>(http.get(path, { params: cleanParams(params) }));

export const classesLookup = () => unwrap<ClassRow[]>(http.get("/classes", { params: { pageSize: 100 } }));
export const subjectsLookup = () => unwrap<SubjectRow[]>(http.get("/subjects", { params: { pageSize: 100 } }));

export const diaryService = {
  list: (p?: ListParams) => list<DiaryRow>("/diary", p),
  create: (b: DiaryInput) => unwrap<DiaryRow>(http.post("/diary", b)),
  update: (id: string, b: Partial<Omit<DiaryInput, "dueDate">> & { dueDate?: string | null }) => unwrap<DiaryRow>(http.patch(`/diary/${id}`, b)),
  remove: (id: string) => unwrap<null>(http.delete(`/diary/${id}`)),
  setCompleted: (id: string, completed: boolean) =>
    unwrap<{ id: string; completed: boolean }>(completed ? http.post(`/diary/${id}/complete`) : http.delete(`/diary/${id}/complete`)),
};

export const assignmentService = {
  list: (p?: ListParams) => list<AssignmentRow>("/assignments", p),
  create: (b: AssignmentInput) => unwrap<AssignmentRow>(http.post("/assignments", b)),
  update: (id: string, b: Partial<Omit<AssignmentInput, "dueDate">> & { dueDate?: string | null }) => unwrap<AssignmentRow>(http.patch(`/assignments/${id}`, b)),
  remove: (id: string) => unwrap<null>(http.delete(`/assignments/${id}`)),
  submissions: (id: string) => unwrap<SubmissionRow[]>(http.get(`/assignments/${id}/submissions`)),
  submit: (id: string, b: { content?: string; fileId?: string }) => unwrap<SubmissionRow>(http.post(`/assignments/${id}/submissions`, b)),
  grade: (id: string, submissionId: string, marks: number) =>
    unwrap<SubmissionRow>(http.patch(`/assignments/${id}/submissions/${submissionId}`, { marks })),
};

export const noticeService = {
  list: (p?: ListParams) => list<NoticeRow>("/notices", p),
  create: (b: NoticeInput) => unwrap<NoticeRow>(http.post("/notices", b)),
  update: (id: string, b: Partial<NoticeInput>) => unwrap<NoticeRow>(http.patch(`/notices/${id}`, b)),
  remove: (id: string) => unwrap<null>(http.delete(`/notices/${id}`)),
};

export const resourceService = {
  list: (p?: ListParams) => list<ResourceRow>("/resources", p),
  get: (id: string) => unwrap<ResourceRow>(http.get(`/resources/${id}`)),
  create: (b: ResourceInput) => unwrap<ResourceRow>(http.post("/resources", b)),
  remove: (id: string) => unwrap<null>(http.delete(`/resources/${id}`)),
  categories: (area?: ResourceArea) => unwrap<{ name: string; count: number }[]>(http.get("/resources/categories", { params: { area } })),
};

export const courseService = {
  list: (p?: ListParams) => list<CourseRow>("/courses", p),
  get: (id: string) => unwrap<CourseDetail>(http.get(`/courses/${id}`)),
  completeLesson: (id: string) => unwrap<{ completionPercent: number }>(http.post(`/lessons/${id}/complete`)),
  paths: () => unwrap<PathRow[]>(http.get("/learning/paths")),
  certificates: () => unwrap<{ placeholder: boolean; items: CertificateRow[] }>(http.get("/learning/certificates")),
};

export const fileService = {
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return unwrap<{ id: string; originalName: string }>(http.post("/files", form));
  },
  /** Downloads through axios so the bearer token is sent, then opens the blob in a new tab. */
  open: async (id: string) => {
    const res = await http.get(`/files/${id}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

export const aiService = {
  suggestions: () => unwrap<string[]>(http.get("/ai/v-buddy/suggestions")),
  chat: (message: string, conversationId?: string) =>
    unwrap<{ conversationId: string; title: string; message: ChatMessageRow }>(http.post("/ai/v-buddy/chat", { message, conversationId })),
  conversations: () => unwrap<ConversationRow[]>(http.get("/ai/v-buddy/conversations", { params: { pageSize: 50 } })),
  conversation: (id: string) => unwrap<ConversationRow & { messages: ChatMessageRow[] }>(http.get(`/ai/v-buddy/conversations/${id}`)),
  removeConversation: (id: string) => unwrap<null>(http.delete(`/ai/v-buddy/conversations/${id}`)),
  solve: (question: string, fileId?: string) => unwrap<SolveResult>(http.post("/ai/instasolve", { question, fileId })),
};
