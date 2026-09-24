import { cleanParams, http, unwrap, unwrapPage, type ListParams } from "./client";

/** Thin CRUD wrapper factory; feature phases add typed rows and extra endpoints on top. */
export function crudApi<Row, Create = Partial<Row>, Update = Partial<Row>>(base: string) {
  return {
    list: (params?: ListParams) => unwrapPage<Row>(http.get(base, { params: cleanParams(params) })),
    get: (id: string) => unwrap<Row>(http.get(`${base}/${id}`)),
    create: (body: Create) => unwrap<Row>(http.post(base, body)),
    update: (id: string, body: Update) => unwrap<Row>(http.patch(`${base}/${id}`, body)),
    remove: (id: string) => unwrap<unknown>(http.delete(`${base}/${id}`)),
  };
}

export type Row = { id: string; [key: string]: unknown };

export const schoolApi = crudApi<Row>("/schools");
export const userApi = crudApi<Row>("/users");
export const studentApi = crudApi<Row>("/students");
export const teacherApi = crudApi<Row>("/teachers");
export const noticeApi = crudApi<Row>("/notices");
export const diaryApi = crudApi<Row>("/diary");

export const academicApi = {
  classes: crudApi<Row>("/classes"),
  sections: crudApi<Row>("/sections"),
  subjects: crudApi<Row>("/subjects"),
};

export const attendanceApi = {
  ...crudApi<Row>("/attendance"),
};

export const learningApi = {
  courses: crudApi<Row>("/courses"),
  resources: crudApi<Row>("/resources"),
};

export { dashboardApi } from "./dashboard";

export const notificationApi = {
  list: async () => {
    const { data } = await http.get("/notifications");
    const items = (Array.isArray(data.data) ? data.data : (data.data?.items ?? [])) as NotificationRow[];
    const unread = (data.meta?.unreadCount as number | undefined) ?? items.filter((n) => !n.read).length;
    return { items, unread };
  },
  markRead: (id: string) => unwrap<unknown>(http.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap<unknown>(http.patch("/notifications/read-all")),
};

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  /** Page to open on click, relative to the role area (e.g. "/leave"). */
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export { searchApi, type SearchGroup, type SearchHit } from "./search";
