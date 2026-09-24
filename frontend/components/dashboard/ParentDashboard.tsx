"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ClipboardList, GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ModuleGrid } from "@/components/navigation/ModuleGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardApi } from "@/lib/api/dashboard";
import { useAuth } from "@/lib/auth";
import { StatCard } from "./StatCard";
import { DashboardError, DashboardSkeleton, NoticeList, Reveal, pct } from "./shared";

export function ParentDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", "parent"], queryFn: dashboardApi.parent });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.firstName ?? ""}`} description={user?.school?.name} />
      {isLoading && <DashboardSkeleton />}
      {error && <DashboardError error={error} onRetry={() => refetch()} />}
      {data && (
        <>
          {!data.children.length && <EmptyState title="No children linked" description="Ask the school office to link your children to your account." />}
          {data.children.map((c, i) => (
            <Reveal key={c.id} index={i}>
              <section aria-label={`${c.name} summary`} className="space-y-3">
                <h2 className="text-lg font-medium">{c.name} <span className="text-sm font-normal text-muted-foreground">{c.className ?? "No class"}{c.sectionName ? ` · Section ${c.sectionName}` : ""} · {c.admissionNumber}</span></h2>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label="Attendance" value={pct(c.attendance.percent)} icon={CalendarCheck} tint="teal" hint={`${c.attendance.absent} absent, ${c.attendance.late} late`} />
                  <StatCard label="Average score" value={pct(c.averagePct)} icon={GraduationCap} tint="indigo" />
                  <StatCard label="Upcoming assignments" value={c.upcomingAssignments} icon={ClipboardList} tint="rose" />
                </div>
              </section>
            </Reveal>
          ))}
          <Reveal index={2}><ModuleGrid /></Reveal>
          <Reveal index={3}><NoticeList notices={data.recentNotices} href="/parent/noticeboard" /></Reveal>
        </>
      )}
    </div>
  );
}
