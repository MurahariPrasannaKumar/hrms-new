"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useClasses, useSubjects } from "@/hooks/useLookups";
import { toApiError } from "@/lib/api/client";
import { teachersApi, type TeacherDetail } from "@/lib/api/people";
import { fmtDate, fullName } from "@/lib/format";
import { QueryBoundary, useCan } from "../shared";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label={title}>
    <h2 className="mb-3 font-medium">{title}</h2>
    {children}
  </section>
);

function SubjectsEditor({ teacher, canEdit }: { teacher: TeacherDetail; canEdit: boolean }) {
  const qc = useQueryClient();
  const subjects = useSubjects();
  const [selected, setSelected] = useState<string[]>(teacher.subjects.map((s) => s.subject.id));
  const save = useMutation({
    mutationFn: () => teachersApi.setSubjects(teacher.id, selected),
    onSuccess: () => { toast.success("Subjects updated"); qc.invalidateQueries({ queryKey: ["teacher", teacher.id] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Card title="Subjects">
      <ul className="flex flex-wrap gap-2">
        {(subjects.data ?? []).map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-default">
              <input type="checkbox" className="accent-primary" disabled={!canEdit} checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.name}
            </label>
          </li>
        ))}
      </ul>
      {canEdit && <Button className="mt-4" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save subjects"}</Button>}
    </Card>
  );
}

function ClassesEditor({ teacher, canEdit }: { teacher: TeacherDetail; canEdit: boolean }) {
  const qc = useQueryClient();
  const classes = useClasses();
  const [rows, setRows] = useState(teacher.classes.map((c) => ({ classId: c.classId, sectionId: c.sectionId })));
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const all = classes.data ?? [];
  const label = (r: { classId: string; sectionId: string }) => {
    const c = all.find((x) => x.id === r.classId);
    return `${c?.name ?? "Class"} · Section ${c?.sections.find((s) => s.id === r.sectionId)?.name ?? "?"}`;
  };
  const save = useMutation({
    mutationFn: () => teachersApi.setClasses(teacher.id, rows),
    onSuccess: () => { toast.success("Class assignments updated"); qc.invalidateQueries({ queryKey: ["teacher", teacher.id] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const add = () => {
    if (!classId || !sectionId || rows.some((r) => r.sectionId === sectionId)) return;
    setRows([...rows, { classId, sectionId }]);
    setSectionId("");
  };
  return (
    <Card title="Classes & sections">
      {rows.length ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {rows.map((r) => (
            <li key={r.sectionId} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
              {label(r)}
              {canEdit && (
                <button type="button" aria-label={`Remove ${label(r)}`} className="rounded-full p-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setRows(rows.filter((x) => x.sectionId !== r.sectionId))}>
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mb-4 text-sm text-muted-foreground">No classes assigned.</p>}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <NativeSelect aria-label="Class" className="w-40" placeholder="Class" value={classId} options={all.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} />
          <NativeSelect aria-label="Section" className="w-32" placeholder="Section" disabled={!classId} value={sectionId} options={(all.find((c) => c.id === classId)?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => setSectionId(e.target.value)} />
          <Button variant="outline" size="sm" onClick={add} disabled={!sectionId}>Add</Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save assignments"}</Button>
        </div>
      )}
    </Card>
  );
}

function Detail({ t }: { t: TeacherDetail }) {
  const can = useCan();
  const canEdit = can("teachers.update");
  const w = t.workload;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Workload">
        {([["Subjects", w.subjects], ["Sections", w.sections], ["Students", w.students], ["Assignments", w.assignments], ["Diary entries", w.diaryEntries]] as const).map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <Card title="Personal details">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {([["Employee ID", t.employeeId], ["Email", t.user.email], ["Phone", t.phone ?? t.user.phone], ["Qualification", t.qualification], ["Joined", fmtDate(t.joiningDate)], ["Last login", t.user.lastLoginAt ? fmtDate(t.user.lastLoginAt) : "Never"]] as const).map(([l, v]) => (
            <div key={l}><dt className="text-xs uppercase tracking-wide text-muted-foreground">{l}</dt><dd className="mt-0.5 font-medium">{v || "—"}</dd></div>
          ))}
        </dl>
      </Card>
      <SubjectsEditor key={`s-${t.subjects.map((s) => s.subject.id).join(",")}`} teacher={t} canEdit={canEdit} />
      <ClassesEditor key={`c-${t.classes.map((c) => c.sectionId).join(",")}`} teacher={t} canEdit={canEdit} />
    </div>
  );
}

export function TeacherProfile({ id, backHref }: { id: string; backHref: string }) {
  const q = useQuery({ queryKey: ["teacher", id], queryFn: () => teachersApi.get(id) });
  return (
    <>
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to teachers
      </Link>
      <PageHeader title={q.data ? fullName(q.data.user) : "Teacher profile"} description={q.data?.user.email} />
      <QueryBoundary loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
        {q.data && <Detail t={q.data} />}
      </QueryBoundary>
    </>
  );
}
