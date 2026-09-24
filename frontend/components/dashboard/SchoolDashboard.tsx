"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ClipboardList, GraduationCap, Layers, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ModuleGrid } from "@/components/navigation/ModuleGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardApi } from "@/lib/api/dashboard";
import { useAuth } from "@/lib/auth";
import { ChartCard } from "./ChartCard";
import { RecentActivity } from "./RecentActivity";
import { StatCard } from "./StatCard";
import { AttendanceTrendChart, COLORS, DashboardError, DashboardSkeleton, NoticeList, Reveal, pct, relTime, toActivity } from "./shared";

export function SchoolDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", "school"], queryFn: dashboardApi.school });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.firstName ?? ""}`} description={user?.school?.name} />
      {isLoading && <DashboardSkeleton />}
      {error && <DashboardError error={error} onRetry={() => refetch()} />}
      {data && (
        <>
          <Reveal>
            <section aria-label="School summary" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard label="Students" value={data.stats.totalStudents} icon={GraduationCap} tint="indigo" />
              <StatCard label="Teachers" value={data.stats.totalTeachers} icon={Users} tint="teal" />
              <StatCard label="Classes" value={data.stats.totalClasses} icon={Layers} tint="sky" />
              <StatCard label="Attendance today" value={pct(data.stats.attendanceTodayPct)} icon={CalendarCheck} tint="amber" />
              <StatCard label="Pending assignments" value={data.stats.pendingAssignments} icon={ClipboardList} tint="rose" />
            </section>
          </Reveal>
          <Reveal index={1}><ModuleGrid /></Reveal>
          <Reveal index={2} className="grid gap-4 lg:grid-cols-2">
            <AttendanceTrendChart data={data.charts.attendanceTrend} />
            <ChartCard title="Student distribution" description="Students per class">
              <BarChart data={data.charts.studentDistribution} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="class" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="Students" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Class performance" description={`School average ${pct(data.academicPerformance.averagePct)}`}>
              <BarChart data={data.charts.classPerformance} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="class" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => [`${v}%`, "Average"]} />
                <Bar dataKey="averagePct" name="Average" fill={COLORS.teal} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Performance by subject" description="Average score">
              <BarChart data={data.academicPerformance.bySubject} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="subject" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => [`${v}%`, "Average"]} />
                <Bar dataKey="averagePct" name="Average" fill={COLORS.amber} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
          </Reveal>
          <Reveal index={3} className="grid gap-4 lg:grid-cols-3">
            <NoticeList notices={data.recentNotices} href="/school/noticeboard" />
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Upcoming events">
              <h3 className="mb-4 font-medium">Upcoming events</h3>
              {!data.upcomingEvents.length ? (
                <EmptyState compact title="No upcoming events" />
              ) : (
                <ul className="space-y-3">
                  {data.upcomingEvents.map((e) => (
                    <li key={e.id}>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.type}{e.publishAt ? ` · ${relTime(e.publishAt)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <RecentActivity items={toActivity(data.recentActivity)} />
          </Reveal>
        </>
      )}
    </div>
  );
}
