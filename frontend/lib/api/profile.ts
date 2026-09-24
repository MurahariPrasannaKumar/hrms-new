import { http, unwrap } from "./client";

export interface ProfileData {
  user: {
    id: string; email: string; firstName: string; lastName: string; phone: string | null; status: string;
    lastLoginAt: string | null; createdAt: string; role: string; school: { id: string; name: string } | null;
  };
  student: {
    admissionNumber: string; dateOfBirth: string | null; gender: "MALE" | "FEMALE" | "OTHER" | null; address: string | null;
    admissionDate: string | null; status: string;
    class: { id: string; name: string; level: number | null; academicYear: { name: string } } | null;
    section: { id: string; name: string } | null;
    parent: { user: { firstName: string; lastName: string; email: string; phone: string | null } } | null;
  } | null;
  teacher: {
    employeeId: string; qualification: string | null; joiningDate: string | null;
    subjects: { id: string; name: string }[];
    classes: { id: string; name: string; level: number | null; sections: { id: string; name: string }[] }[];
  } | null;
}

export interface ProfileUpdate {
  firstName?: string; lastName?: string; phone?: string | null;
  address?: string | null; gender?: "MALE" | "FEMALE" | "OTHER" | null; dateOfBirth?: string | null;
  qualification?: string | null;
}

export const profileApi = {
  get: () => unwrap<ProfileData>(http.get("/profile")),
  update: (body: ProfileUpdate) => unwrap<ProfileData>(http.patch("/profile", body)),
  setTeachingClasses: (classIds: string[]) => unwrap<unknown>(http.put("/profile/teaching-classes", { classIds })),
};

export const classNotifyApi = {
  send: (classId: string, body: { sectionId?: string; subject: string; message: string }) =>
    unwrap<{ students: number; inApp: number; emailOnly: number }>(http.post(`/classes/${classId}/notify`, body)),
};
