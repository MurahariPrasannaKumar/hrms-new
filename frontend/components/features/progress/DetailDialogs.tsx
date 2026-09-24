"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { progressApi } from "@/lib/api/attendance-progress";
import { QueryBoundary } from "../shared";
import { LEVEL_COLOR, levelFor } from "../attendance/attendance-utils";
import { TrendChart } from "../attendance/TrendChart";
import { fmtWhen, RiskBadge } from "./parts";

interface Props {
  id: string | null;
  schoolId?: string;
  onClose: () => void;
}

const wide = "max-h-[92vh] overflow-y-auto sm:max-w-4xl";
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—");

export function StudentProgressDialog({ id, schoolId, onClose }: Props) {
  const q = useQuery({ queryKey: ["progress", "student", id, schoolId], queryFn: () => progressApi.student(id!, { schoolId: schoolId || undefined }), enabled: !!id });
  const d = q.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={wide}>
        <DialogHeader>
          <DialogTitle>{d ? d.student.name : "Student progress"}</DialogTitle>
          <DialogDescription>
            {d ? `${d.student.admissionNumber} · ${d.student.class ?? "No class"}${d.student.section ? ` - ${d.student.section}` : ""}${d.student.parent ? ` · Parent: ${d.student.parent.name}` : ""}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        <QueryBoundary loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {d && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><RiskBadge risk={d.metrics.riskLevel} /></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Attendance" value={d.metrics.attendancePct === null ? "—" : `${d.metrics.attendancePct}%`} hint={`${d.attendance.overall.totalDays} days recorded`} tint="emerald" />
                <StatCard label="Exam average" value={d.metrics.avgExamPct === null ? "—" : `${d.metrics.avgExamPct}%`} tint="amber" />
                <StatCard label="Assignments" value={`${d.metrics.assignmentsSubmitted}/${d.metrics.assignmentsTotal}`} hint="submitted" tint="sky" />
                <StatCard label="Lessons completed" value={d.metrics.lessonsCompleted} tint="violet" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <TrendChart trend={d.attendance.trend} title="Attendance trend" height={220} />
                <ChartCard title="Subject performance" description="Average exam score per subject" height={220}>
                  <BarChart data={d.subjects.map((s) => ({ name: s.subject, value: s.averagePct }))} margin={{ left: -16, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} />
                    <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="value" name="Average" radius={[6, 6, 0, 0]}>
                      {d.subjects.map((s) => <Cell key={s.subject} fill={s.averagePct < 40 ? LEVEL_COLOR.risk : s.averagePct < 55 ? LEVEL_COLOR.watch : LEVEL_COLOR[levelFor(90)]} />)}
                    </Bar>
                  </BarChart>
                </ChartCard>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="font-medium">Assignments</h3>
                  {d.assignments.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No assignments for this class yet.</p> : (
                    <ul className="mt-2 divide-y">
                      {d.assignments.slice(0, 8).map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0"><span className="block truncate">{a.title}</span><span className="text-xs text-muted-foreground">{a.subject} · due {fmtDate(a.dueDate)}</span></span>
                          <StatusBadge status={a.submitted ? "PRESENT" : "PENDING"} className="shrink-0" />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="font-medium">Recent learning</h3>
                  {d.learning.recent.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No lessons completed yet.</p> : (
                    <ul className="mt-2 divide-y">
                      {d.learning.recent.map((l, i) => (
                        <li key={i} className="py-2 text-sm"><span className="block">{l.lesson}</span><span className="text-xs text-muted-foreground">{l.course} · {fmtDate(l.completedAt)}</span></li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}

export function TeacherProgressDialog({ id, schoolId, onClose }: Props) {
  const q = useQuery({ queryKey: ["progress", "teacher", id, schoolId], queryFn: () => progressApi.teacher(id!, { schoolId: schoolId || undefined }), enabled: !!id });
  const d = q.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={wide}>
        <DialogHeader>
          <DialogTitle>{d ? d.teacher.name : "Teacher activity"}</DialogTitle>
          <DialogDescription>{d ? `${d.teacher.employeeId} · ${d.teacher.email} · last active ${fmtWhen(d.teacher.lastActiveAt)}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        <QueryBoundary loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {d && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard label="Check-in rate" value={d.teacher.attendancePct === null ? "—" : `${d.teacher.attendancePct}%`} tint="emerald" />
                <StatCard label="Roll calls (30d)" value={d.teacher.daysAttendanceMarked30d} tint="sky" />
                <StatCard label="Assignments" value={d.teacher.assignmentsCreated} tint="amber" />
                <StatCard label="Diary (30d)" value={d.teacher.diaryEntries30d} tint="violet" />
                <StatCard label="Notices" value={d.teacher.noticesPublished} tint="orange" />
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {d.teacher.subjects.map((s) => <span key={s} className="rounded-full bg-accent px-2.5 py-0.5 text-accent-foreground">{s}</span>)}
                {d.teacher.classes.map((c) => <span key={c} className="rounded-full bg-muted px-2.5 py-0.5">{c}</span>)}
              </div>
              <TrendChart trend={d.attendance.trend} title="Check-in trend" description="Monthly check-in rate (weekdays)" height={220} />
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="font-medium">Recent assignments</h3>
                  {d.recentAssignments.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None created yet.</p> : (
                    <ul className="mt-2 divide-y">
                      {d.recentAssignments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0"><span className="block truncate">{a.title}</span><span className="text-xs text-muted-foreground">{a.class} · {a.subject}</span></span>
                          <span className="shrink-0 text-xs text-muted-foreground">{a.submissions} submitted</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="font-medium">Recent diary entries</h3>
                  {d.recentDiary.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None posted yet.</p> : (
                    <ul className="mt-2 divide-y">
                      {d.recentDiary.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0"><span className="block truncate">{e.title}</span><span className="text-xs text-muted-foreground">{e.class}{e.isHomework ? " · homework" : ""}</span></span>
                          <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}
