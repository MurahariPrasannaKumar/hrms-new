import { useQuery } from "@tanstack/react-query";
import { http, unwrap } from "@/lib/api/client";
import { academicsApi } from "@/lib/api/people";
import { useAuth } from "@/lib/auth";

const ALL = { pageSize: 100 };

export const useClasses = () =>
  useQuery({ queryKey: ["lookup", "classes"], queryFn: () => academicsApi.classes.list(ALL), staleTime: 60_000, select: (d) => d.items });

export const useSubjects = () =>
  useQuery({ queryKey: ["lookup", "subjects"], queryFn: () => academicsApi.subjects.list(ALL), staleTime: 60_000, select: (d) => d.items });

export const useYears = () =>
  useQuery({ queryKey: ["lookup", "years"], queryFn: () => academicsApi.years.list(ALL), staleTime: 60_000, select: (d) => d.items });

export interface AssignableClass { id: string; name: string; sections: { id: string; name: string }[] }

/** Classes/sections the caller may act on: teachers get only their assignments, admins get everything. */
export const useAssignableClasses = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  return useQuery<AssignableClass[]>({
    queryKey: ["lookup", "assignable-classes", isTeacher],
    queryFn: async () =>
      isTeacher
        ? unwrap<AssignableClass[]>(http.get("/teachers/me/classes"))
        : (await academicsApi.classes.list(ALL)).items.map((c) => ({ id: c.id, name: c.name, sections: c.sections })),
    staleTime: 60_000,
    enabled: !!user,
  });
};
