"use client";

import { ClipboardList, Send } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClasses, useSubjects, useYears } from "@/hooks/useLookups";
import { academicsApi, type ClassRow, type ExamRow, type SubjectRow, type YearRow } from "@/lib/api/people";
import { fmtDate } from "@/lib/format";
import { QueryBoundary, useCan } from "../shared";
import { MasterTable } from "./MasterTable";
import { NotifyClassDialog } from "./NotifyClassDialog";
import { ResultsDialog } from "./ResultsDialog";

const iso = (v: string | boolean | undefined) => (typeof v === "string" && v ? new Date(`${v}T00:00:00.000Z`).toISOString() : "");
const day = (v?: string) => (v ? v.slice(0, 10) : "");

function Hierarchy() {
  const canManage = useCan()("academics.manage");
  const years = useYears();
  const classes = useClasses();
  const subjects = useSubjects();
  const loading = years.isLoading || classes.isLoading || subjects.isLoading;
  const error = years.error ?? classes.error ?? subjects.error;
  return (
    <QueryBoundary loading={loading} error={error} onRetry={() => { years.refetch(); classes.refetch(); subjects.refetch(); }} empty={!years.data?.length} emptyTitle="No academic years yet" emptyDescription={canManage ? "Open the Years tab to add an academic year, then add classes, sections and subjects." : "Ask your school administrator to set up the academic year."}>
      <div className="space-y-4">
        {(years.data ?? []).map((y) => (
          <section key={y.id} className="rounded-2xl border bg-card p-5 shadow-sm" aria-label={`Academic year ${y.name}`}>
            <h3 className="flex items-center gap-2 font-medium">{y.name}{y.isCurrent && <StatusBadge status="ACTIVE" />}</h3>
            <p className="text-xs text-muted-foreground">{fmtDate(y.startDate)} – {fmtDate(y.endDate)}</p>
            <ul className="mt-3 space-y-2">
              {(classes.data ?? []).filter((c) => c.academicYearId === y.id).map((c) => (
                <li key={c.id} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-sm font-medium">{c.name} <span className="font-normal text-muted-foreground">· {c._count.students} students</span></p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {c.sections.map((s) => (
                      <li key={s.id} className="rounded-full border bg-background px-3 py-0.5 text-xs">Section {s.name} · {s._count.students}</li>
                    ))}
                    {!c.sections.length && <li className="text-xs text-muted-foreground">No sections</li>}
                  </ul>
                </li>
              ))}
              {!(classes.data ?? []).some((c) => c.academicYearId === y.id) && <li className="text-sm text-muted-foreground">No classes in this year.</li>}
            </ul>
          </section>
        ))}
        {!!subjects.data?.length && (
          <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Subjects">
            <h3 className="mb-2 font-medium">Subjects</h3>
            <ul className="flex flex-wrap gap-2">
              {subjects.data.map((s) => <li key={s.id} className="rounded-full border px-3 py-1 text-sm">{s.name} <span className="text-muted-foreground">({s.code})</span></li>)}
            </ul>
          </section>
        )}
      </div>
    </QueryBoundary>
  );
}

function Years({ canManage }: { canManage: boolean }) {
  return (
    <MasterTable<YearRow>
      entity="Academic year" queryKey="years" canManage={canManage}
      list={(p) => academicsApi.years.list(p)}
      create={(v) => academicsApi.years.create({ name: String(v.name), startDate: iso(v.startDate), endDate: iso(v.endDate), isCurrent: !!v.isCurrent })}
      update={(id, v) => academicsApi.years.update(id, { name: String(v.name), startDate: iso(v.startDate), endDate: iso(v.endDate), isCurrent: !!v.isCurrent })}
      remove={(id) => academicsApi.years.remove(id)}
      fields={[
        { name: "name", label: "Name (e.g. 2026-27)", required: true },
        { name: "startDate", label: "Start date", type: "date", required: true },
        { name: "endDate", label: "End date", type: "date", required: true },
        { name: "isCurrent", label: "Current academic year", type: "checkbox" },
      ]}
      toInitial={(y) => ({ name: y.name, startDate: day(y.startDate), endDate: day(y.endDate), isCurrent: y.isCurrent })}
      columns={[
        { key: "name", header: "Year" },
        { key: "startDate", header: "Starts", cell: (y) => fmtDate(y.startDate) },
        { key: "endDate", header: "Ends", cell: (y) => fmtDate(y.endDate) },
        { key: "isCurrent", header: "Current", cell: (y) => (y.isCurrent ? <StatusBadge status="ACTIVE" /> : "—") },
      ]}
    />
  );
}

function Classes({ canManage }: { canManage: boolean }) {
  const years = useYears();
  const classes = useClasses();
  const [notifying, setNotifying] = useState<ClassRow | null>(null);
  const sectionCols = (c: ClassRow) => (c.sections.length ? c.sections.map((s) => s.name).join(", ") : "—");
  return (
    <div className="space-y-6">
      <MasterTable<ClassRow>
        entity="Class" queryKey="classes" canManage={canManage}
        list={(p) => academicsApi.classes.list(p)}
        create={(v) => academicsApi.classes.create({ academicYearId: String(v.academicYearId), name: String(v.name), level: v.level === "" ? undefined : Number(v.level) })}
        update={(id, v) => academicsApi.classes.update(id, { name: String(v.name), level: v.level === "" ? undefined : Number(v.level) })}
        remove={(id) => academicsApi.classes.remove(id)}
        fields={(row) => [
          { name: "academicYearId", label: "Academic year", type: "select", required: true, disabled: !!row, options: (years.data ?? []).map((y) => ({ value: y.id, label: y.name })) },
          { name: "name", label: "Class name", required: true },
          { name: "level", label: "Grade / level number (optional, used for sorting)", type: "number" },
        ]}
        toInitial={(c) => ({ academicYearId: c.academicYearId, name: c.name, level: c.level == null ? "" : String(c.level) })}
        extraActions={(c) => canManage && (
          <Button variant="ghost" size="sm" aria-label={`Message ${c.name} students`} onClick={() => setNotifying(c)}>
            <Send className="size-4" aria-hidden /> Notify
          </Button>
        )}
        columns={[
          { key: "name", header: "Class" },
          { key: "academicYear", header: "Year", cell: (c) => c.academicYear.name },
          { key: "sections", header: "Sections", cell: sectionCols },
          { key: "students", header: "Students", cell: (c) => c._count.students },
        ]}
      />
      <NotifyClassDialog cls={notifying} onClose={() => setNotifying(null)} />
      <div>
        <h3 className="mb-2 text-sm font-medium">Sections</h3>
        <MasterTable<{ id: string; name: string; class: { id: string; name: string }; _count: { students: number } }>
          entity="Section" queryKey="sections" canManage={canManage}
          list={(p) => academicsApi.sections.list(p) as never}
          create={(v) => academicsApi.sections.create({ classId: String(v.classId), name: String(v.name) })}
          update={(id, v) => academicsApi.sections.update(id, { name: String(v.name) })}
          remove={(id) => academicsApi.sections.remove(id)}
          fields={(row) => [
            { name: "classId", label: "Class", type: "select", required: true, disabled: !!row, options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
            { name: "name", label: "Section name", required: true },
          ]}
          toInitial={(s) => ({ classId: s.class.id, name: s.name })}
          columns={[
            { key: "class", header: "Class", cell: (s) => s.class.name },
            { key: "name", header: "Section" },
            { key: "students", header: "Students", cell: (s) => s._count.students },
          ]}
        />
      </div>
    </div>
  );
}

function Subjects({ canManage }: { canManage: boolean }) {
  return (
    <MasterTable<SubjectRow>
      entity="Subject" queryKey="subjects" canManage={canManage}
      list={(p) => academicsApi.subjects.list(p)}
      create={(v) => academicsApi.subjects.create({ name: String(v.name), code: String(v.code) })}
      update={(id, v) => academicsApi.subjects.update(id, { name: String(v.name), code: String(v.code) })}
      remove={(id) => academicsApi.subjects.remove(id)}
      fields={[{ name: "name", label: "Subject name", required: true }, { name: "code", label: "Code", required: true }]}
      toInitial={(s) => ({ name: s.name, code: s.code })}
      columns={[{ key: "name", header: "Subject" }, { key: "code", header: "Code" }]}
    />
  );
}

function Exams({ canManage }: { canManage: boolean }) {
  const years = useYears();
  const classes = useClasses();
  const subjects = useSubjects();
  const [open, setOpen] = useState<ExamRow | null>(null);
  return (
    <>
      <MasterTable<ExamRow>
        entity="Exam" queryKey="exams" canManage={canManage}
        list={(p) => academicsApi.exams.list(p)}
        create={(v) => academicsApi.exams.create({
          academicYearId: String(v.academicYearId), classId: String(v.classId), subjectId: String(v.subjectId),
          name: String(v.name), date: iso(v.date), maxMarks: v.maxMarks === "" ? undefined : Number(v.maxMarks),
        })}
        update={(id, v) => academicsApi.exams.update(id, { name: String(v.name), date: iso(v.date), maxMarks: Number(v.maxMarks) } as never)}
        remove={(id) => academicsApi.exams.remove(id)}
        fields={(row) => [
          { name: "name", label: "Exam name", required: true },
          { name: "academicYearId", label: "Academic year", type: "select", required: true, disabled: !!row, options: (years.data ?? []).map((y) => ({ value: y.id, label: y.name })) },
          { name: "classId", label: "Class", type: "select", required: true, disabled: !!row, options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { name: "subjectId", label: "Subject", type: "select", required: true, disabled: !!row, options: (subjects.data ?? []).map((s) => ({ value: s.id, label: s.name })) },
          { name: "date", label: "Date", type: "date", required: true },
          { name: "maxMarks", label: "Maximum marks", type: "number" },
        ]}
        toInitial={(e) => ({ name: e.name, academicYearId: e.academicYearId, classId: e.classId, subjectId: e.subjectId, date: day(e.date), maxMarks: String(e.maxMarks) })}
        columns={[
          { key: "name", header: "Exam" },
          { key: "class", header: "Class", cell: (e) => e.class?.name ?? classes.data?.find((c) => c.id === e.classId)?.name ?? "—" },
          { key: "subject", header: "Subject", cell: (e) => e.subject?.name ?? subjects.data?.find((s) => s.id === e.subjectId)?.name ?? "—" },
          { key: "date", header: "Date", cell: (e) => fmtDate(e.date) },
          { key: "maxMarks", header: "Max marks" },
        ]}
        extraActions={(e) => (
          <Button variant="ghost" size="sm" aria-label={`Results for ${e.name}`} onClick={() => setOpen(e)}>
            <ClipboardList className="size-4" aria-hidden /> Results
          </Button>
        )}
      />
      <ResultsDialog exam={open} canEdit={canManage} onClose={() => setOpen(null)} />
    </>
  );
}

export function AcademicsPage({ title = "Academics", description }: { title?: string; description?: string }) {
  const can = useCan();
  const canManage = can("academics.manage");
  return (
    <>
      <PageHeader title={title} description={description ?? "Academic years, classes, sections, subjects and exams."} />
      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Hierarchy</TabsTrigger>
          <TabsTrigger value="years">Years</TabsTrigger>
          <TabsTrigger value="classes">Classes &amp; sections</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="exams">Exams &amp; results</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><Hierarchy /></TabsContent>
        <TabsContent value="years" className="mt-4"><Years canManage={canManage} /></TabsContent>
        <TabsContent value="classes" className="mt-4"><Classes canManage={canManage} /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><Subjects canManage={canManage} /></TabsContent>
        <TabsContent value="exams" className="mt-4"><Exams canManage={canManage} /></TabsContent>
      </Tabs>
    </>
  );
}
