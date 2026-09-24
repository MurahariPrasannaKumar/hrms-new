"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { studentsApi, type StudentDetail } from "@/lib/api/people";
import { fmtDate, fullName } from "@/lib/format";
import { QueryBoundary } from "../shared";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium">{children || "—"}</dd>
  </div>
);

const Panel = ({ children }: { children: ReactNode }) => <div className="rounded-2xl border bg-card p-5 shadow-sm">{children}</div>;
const Grid = ({ children }: { children: ReactNode }) => <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function Profile({ s }: { s: StudentDetail }) {
  const a = s.attendance;
  return (
    <Tabs defaultValue="personal">
      <TabsList className="h-auto flex-wrap">
        {["personal", "parent", "class", "attendance", "performance", "assignments"].map((t) => (
          <TabsTrigger key={t} value={t} className="capitalize">{t === "performance" ? "Academic performance" : t}</TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="personal" className="mt-4">
        <Panel>
          <Grid>
            <Field label="Admission number">{s.admissionNumber}</Field>
            <Field label="Full name">{fullName(s)}</Field>
            <Field label="Date of birth">{fmtDate(s.dateOfBirth)}</Field>
            <Field label="Gender">{s.gender?.toLowerCase()}</Field>
            <Field label="Email">{s.email}</Field>
            <Field label="Phone">{s.phone}</Field>
            <Field label="Address">{s.address}</Field>
            <Field label="Admission date">{fmtDate(s.admissionDate)}</Field>
            <Field label="Status"><StatusBadge status={s.status} /></Field>
          </Grid>
        </Panel>
      </TabsContent>

      <TabsContent value="parent" className="mt-4">
        <Panel>
          {s.parent ? (
            <Grid>
              <Field label="Name">{fullName(s.parent.user)}</Field>
              <Field label="Email">{s.parent.user.email}</Field>
              <Field label="Phone">{s.parent.phone ?? s.parent.user.phone}</Field>
            </Grid>
          ) : <Empty text="No parent linked to this student." />}
        </Panel>
      </TabsContent>

      <TabsContent value="class" className="mt-4">
        <Panel>
          <Grid>
            <Field label="Class">{s.class?.name}</Field>
            <Field label="Section">{s.section?.name}</Field>
            <Field label="Level">{s.class?.level != null ? String(s.class.level) : ""}</Field>
          </Grid>
        </Panel>
      </TabsContent>

      <TabsContent value="attendance" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["Attendance", `${a.percentage}%`], ["Present", a.PRESENT], ["Absent", a.ABSENT], ["Late", a.LATE], ["Excused", a.EXCUSED]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="mt-1 text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <Panel>
          <h3 className="mb-3 text-sm font-medium">Recent records</h3>
          {a.recent.length ? (
            <ul className="divide-y">
              {a.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{fmtDate(r.attendance.date)}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          ) : <Empty text="No attendance recorded yet." />}
        </Panel>
      </TabsContent>

      <TabsContent value="performance" className="mt-4">
        <Panel>
          {s.results.length ? (
            <ul className="divide-y">
              {s.results.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{r.exam.name}{r.exam.subject ? ` · ${r.exam.subject.name}` : ""} <span className="text-muted-foreground">({fmtDate(r.exam.date)})</span></span>
                  <span className="font-medium">{r.marks}/{r.exam.maxMarks}{r.grade ? ` · ${r.grade}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <Empty text="No exam results yet." />}
        </Panel>
      </TabsContent>

      <TabsContent value="assignments" className="mt-4">
        <Panel>
          {s.assignments.length ? (
            <ul className="divide-y">
              {s.assignments.map((x) => (
                <li key={x.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{x.title}{x.subject ? <span className="text-muted-foreground"> · {x.subject.name}</span> : null}</span>
                  <span className="text-muted-foreground">Due {fmtDate(x.dueDate)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty text="No assignments for this class." />}
        </Panel>
      </TabsContent>
    </Tabs>
  );
}

export function StudentProfile({ id, backHref }: { id: string; backHref: string }) {
  const q = useQuery({ queryKey: ["student", id], queryFn: () => studentsApi.get(id) });
  return (
    <>
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to students
      </Link>
      <PageHeader title={q.data ? fullName(q.data) : "Student profile"} description={q.data ? `Admission no. ${q.data.admissionNumber}` : undefined} />
      <QueryBoundary loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
        {q.data && <Profile s={q.data} />}
      </QueryBoundary>
    </>
  );
}
