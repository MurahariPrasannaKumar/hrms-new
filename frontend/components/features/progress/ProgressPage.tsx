"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, GaugeCircle, Percent, Users } from "lucide-react";
import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/forms/FilterBar";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListState } from "@/hooks/useListState";
import { useAssignableClasses } from "@/hooks/useLookups";
import { adminSchoolApi } from "@/lib/api/admin";
import { progressApi } from "@/lib/api/attendance-progress";
import { academicsApi } from "@/lib/api/people";
import { StudentProgressDialog, TeacherProgressDialog } from "./DetailDialogs";
import { StudentProgressTable } from "./StudentProgressTable";
import { TeacherProgressTable } from "./TeacherProgressTable";
import { RiskBadge } from "./parts";

export type ProgressMode = "school" | "admin" | "teacher";

function useProgressClasses(mode: ProgressMode, schoolId: string) {
  const assignable = useAssignableClasses();
  const admin = useQuery({
    queryKey: ["lookup", "progress-classes", schoolId],
    queryFn: async () => (await academicsApi.classes.list({ pageSize: 100, schoolId })).items.map((c) => ({ id: c.id, name: c.name, sections: c.sections })),
    enabled: mode === "admin" && !!schoolId,
  });
  return mode === "admin" ? admin.data ?? [] : assignable.data ?? [];
}

function Summary({ schoolId, classId, sectionId, onSelect }: { schoolId: string; classId: string; sectionId: string; onSelect: (id: string) => void }) {
  const q = useQuery({
    queryKey: ["progress", "summary", schoolId, classId, sectionId],
    queryFn: () => progressApi.summary({ schoolId: schoolId || undefined, classId: classId || undefined, sectionId: sectionId || undefined }),
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="At risk" value={d?.risk.at_risk} icon={AlertTriangle} tint="rose" hint="Attendance < 75% or exam avg < 40%" loading={q.isLoading} />
        <StatCard label="Needs watching" value={d?.risk.watch} icon={GaugeCircle} tint="amber" hint="Attendance < 85% or exam avg < 55%" loading={q.isLoading} />
        <StatCard label="Avg attendance" value={d?.avgAttendancePct == null ? "—" : `${d.avgAttendancePct}%`} icon={Percent} tint="emerald" loading={q.isLoading} />
        <StatCard label="Students tracked" value={d?.totalStudents} icon={Users} tint="sky" hint={d?.avgExamPct == null ? undefined : `Exam average ${d.avgExamPct}%`} loading={q.isLoading} />
      </div>
      {d && d.lowestAttendance.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Lowest attendance">
          <h3 className="font-medium">Lowest attendance</h3>
          <ul className="mt-2 divide-y">
            {d.lowestAttendance.map((s) => (
              <li key={s.studentId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <button type="button" className="min-w-0 text-left hover:underline" onClick={() => onSelect(s.studentId)}>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.class ?? ""}{s.section ? ` - ${s.section}` : ""}</span>
                </button>
                <span className="flex shrink-0 items-center gap-3"><span className="tabular-nums">{s.attendancePct}%</span><RiskBadge risk={s.riskLevel} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StudentsSection({ mode, schoolId }: { mode: ProgressMode; schoolId: string }) {
  const list = useListState({ by: "riskLevel", order: "desc" }, 10);
  const [selected, setSelected] = useState<string | null>(null);
  const classes = useProgressClasses(mode, schoolId);
  const classId = list.filters.classId ?? "";
  const sectionId = list.filters.sectionId ?? "";
  const params = { ...list.params, schoolId: schoolId || undefined };

  const q = useQuery({ queryKey: ["progress", "students", params], queryFn: () => progressApi.students(params), placeholderData: keepPreviousData });

  return (
    <>
      <Summary schoolId={schoolId} classId={classId} sectionId={sectionId} onSelect={setSelected} />
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search name or admission no.">
        <NativeSelect aria-label="Class" placeholder="All classes" value={classId} options={classes.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(e) => { list.setFilter("classId", e.target.value); list.setFilter("sectionId", ""); }} />
        <NativeSelect aria-label="Section" placeholder="All sections" disabled={!classId} value={sectionId}
          options={(classes.find((c) => c.id === classId)?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => list.setFilter("sectionId", e.target.value)} />
        <NativeSelect aria-label="Status" placeholder="All statuses" value={list.filters.risk ?? ""}
          options={[{ value: "at_risk", label: "At risk" }, { value: "watch", label: "Watch" }, { value: "ok", label: "On track" }]}
          onChange={(e) => list.setFilter("risk", e.target.value)} />
      </FilterBar>
      <StudentProgressTable
        rows={q.data?.items}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={q.data?.meta.total ?? 0}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        onSelect={setSelected}
      />
      <StudentProgressDialog id={selected} schoolId={schoolId} onClose={() => setSelected(null)} />
    </>
  );
}

function TeachersSection({ schoolId }: { schoolId: string }) {
  const list = useListState({ by: "name", order: "asc" }, 10);
  const [selected, setSelected] = useState<string | null>(null);
  const params = { ...list.params, schoolId: schoolId || undefined };
  const q = useQuery({ queryKey: ["progress", "teachers", params], queryFn: () => progressApi.teachers(params), placeholderData: keepPreviousData });
  return (
    <>
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search name or employee ID" />
      <TeacherProgressTable
        rows={q.data?.items}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={q.data?.meta.total ?? 0}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        onSelect={setSelected}
      />
      <TeacherProgressDialog id={selected} schoolId={schoolId} onClose={() => setSelected(null)} />
    </>
  );
}

/** Progress tracking: admins see students + teachers, teachers see their assigned students. */
export function ProgressPage({ mode }: { mode: ProgressMode }) {
  const [schoolId, setSchoolId] = useState("");
  const schools = useQuery({ queryKey: ["lookup", "schools"], queryFn: () => adminSchoolApi.list({ pageSize: 100 }), enabled: mode === "admin", staleTime: 60_000 });

  const description = mode === "teacher" ? "How the students in your classes are doing." : "Track how students and teachers are performing.";
  return (
    <>
      <PageHeader
        title="Progress"
        description={description}
        actions={mode === "admin" ? (
          <div className="w-56">
            <FormField id="progress-school" label="School">
              <NativeSelect id="progress-school" placeholder="All schools" value={schoolId} options={(schools.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => setSchoolId(e.target.value)} />
            </FormField>
          </div>
        ) : undefined}
      />
      {mode === "teacher" ? (
        <StudentsSection mode={mode} schoolId="" />
      ) : (
        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
          </TabsList>
          <TabsContent value="students" className="mt-4"><StudentsSection mode={mode} schoolId={schoolId} /></TabsContent>
          <TabsContent value="teachers" className="mt-4"><TeachersSection schoolId={schoolId} /></TabsContent>
        </Tabs>
      )}
    </>
  );
}
