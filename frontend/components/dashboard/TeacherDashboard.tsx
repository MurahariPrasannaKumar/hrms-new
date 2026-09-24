"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, ClipboardList, GraduationCap } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ModuleGrid } from "@/components/navigation/ModuleGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardApi } from "@/lib/api/dashboard";
import { useAuth } from "@/lib/auth";
import { UsageTimerCard } from "@/components/usage/UsageTimerCard";
import { StatCard } from "./StatCard";
import { AttendanceTrendChart, DashboardError, DashboardSkeleton, NoticeList, Reveal, relTime } from "./shared";

export function TeacherDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", "teacher"], queryFn: dashboardApi.teacher });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.firstName ?? ""}`} description={user?.school?.name} />
      <UsageTimerCard />
      {isLoading && <DashboardSkeleton />}
      {error && <DashboardError error={error} onRetry={() => refetch()} />}
      {data && (
        <>
          <Reveal>
            <section aria-label="Teaching summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Assigned classes" value={data.stats.assignedClasses} icon={BookOpen} tint="indigo" />
              <StatCard label="Students" value={data.stats.totalStudents} icon={GraduationCap} tint="teal" />
              <StatCard label="Pending assignments" value={data.stats.pendingAssignments} icon={ClipboardList} tint="rose" />
              <StatCard label="Attendance pending" value={data.stats.attendancePending} icon={CalendarCheck} tint="amber" hint="Sections not marked today" />
            </section>
          </Reveal>
          <Reveal index={1}><ModuleGrid /></Reveal>
          <Reveal index={2} className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="My classes">
              <h3 className="mb-4 font-medium">My classes</h3>
              {!data.classes.length ? (
                <EmptyState compact title="No classes assigned" description="Ask your school administrator to assign you to a class and section." />
              ) : (
                <ul className="divide-y">
                  {data.classes.map((c) => (
                    <li key={`${c.classId}-${c.sectionId}`} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{c.className} · Section {c.sectionName}</p>
                        <p className="text-xs text-muted-foreground">{c.studentCount} students</p>
                      </div>
                      {c.attendanceMarkedToday ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Marked</span>
                      ) : (
                        <Link href="/teacher/attendance" className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:underline">Mark attendance</Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <AttendanceTrendChart data={data.charts.attendanceTrend} />
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Recent diary">
              <h3 className="mb-4 font-medium">Recent diary entries</h3>
              {!data.recentDiary.length ? (
                <EmptyState compact title="No diary entries" />
              ) : (
                <ul className="space-y-3">
                  {data.recentDiary.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{d.dueDate ? `Due ${relTime(d.dueDate)}` : relTime(d.createdAt)}</p>
                      </div>
                      {d.isHomework && <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">Homework</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <NoticeList notices={data.recentNotices} href="/teacher/noticeboard" />
          </Reveal>
        </>
      )}
    </div>
  );
}
