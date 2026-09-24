"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, CalendarCheck, ClipboardList, Library } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ModuleGrid } from "@/components/navigation/ModuleGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardApi } from "@/lib/api/dashboard";
import { useAuth } from "@/lib/auth";
import { UsageTimerCard } from "@/components/usage/UsageTimerCard";
import { ChartCard } from "./ChartCard";
import { StatCard } from "./StatCard";
import { COLORS, DashboardError, DashboardSkeleton, NoticeList, Reveal, pct, relTime } from "./shared";

export function StudentDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", "student"], queryFn: dashboardApi.student });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ""}`}
        description={data ? `${data.student.className ?? "No class"}${data.student.sectionName ? ` · Section ${data.student.sectionName}` : ""} · ${data.student.admissionNumber}` : user?.school?.name}
      />
      <UsageTimerCard />
      {isLoading && <DashboardSkeleton />}
      {error && <DashboardError error={error} onRetry={() => refetch()} />}
      {data && (
        <>
          <Reveal>
            <section aria-label="My summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Attendance" value={pct(data.attendance.percent)} icon={CalendarCheck} tint="teal" hint={`${data.attendance.present} present of ${data.attendance.total} days`} />
              <StatCard label="Average score" value={pct(data.performance.averagePct)} icon={Award} tint="indigo" />
              <StatCard label="Upcoming assignments" value={data.upcomingAssignments.length} icon={ClipboardList} tint="rose" />
              <StatCard label="Learning progress" value={pct(data.learning.progressPct)} icon={Library} tint="amber" hint={`${data.learning.completedLessons}/${data.learning.totalLessons} lessons`} />
            </section>
          </Reveal>
          <Reveal index={1}><ModuleGrid /></Reveal>
          <Reveal index={2} className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Performance by subject" description="Average score">
              <BarChart data={data.performance.bySubject} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="subject" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => [`${v}%`, "Average"]} />
                <Bar dataKey="averagePct" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Upcoming assignments">
              <h3 className="mb-4 font-medium">Upcoming assignments</h3>
              {!data.upcomingAssignments.length ? (
                <EmptyState compact title="Nothing due" description="You’re all caught up." />
              ) : (
                <ul className="space-y-3">
                  {data.upcomingAssignments.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.subject}{a.dueDate ? ` · due ${relTime(a.dueDate)}` : ""}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${a.submitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {a.submitted ? "Submitted" : "Pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Recent exam results">
              <h3 className="mb-4 font-medium">Recent results</h3>
              {!data.performance.recent.length ? (
                <EmptyState compact title="No results yet" />
              ) : (
                <ul className="divide-y">
                  {data.performance.recent.map((r, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span>{r.exam} · {r.subject}</span>
                      <span className="font-medium">{r.marks}/{r.maxMarks} ({r.pct}%)</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <NoticeList notices={data.recentNotices} href="/student/noticeboard" />
          </Reveal>
        </>
      )}
    </div>
  );
}
