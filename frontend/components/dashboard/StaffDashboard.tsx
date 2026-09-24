"use client";

import { useQuery } from "@tanstack/react-query";
import { ModuleGrid } from "@/components/navigation/ModuleGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { noticeApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth";
import { DashboardError, NoticeList, Reveal } from "./shared";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoticeBrief } from "@/lib/api/dashboard";

/** Staff have no dedicated dashboard endpoint: show permitted modules plus published notices. */
export function StaffDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", "staff-notices"],
    queryFn: () => noticeApi.list({ page: 1, pageSize: 5 }),
    enabled: !!user?.permissions.includes("notices.read"),
  });
  const notices = (data?.items ?? []) as unknown as NoticeBrief[];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.firstName ?? ""}`} description={user?.school?.name} />
      <Reveal><ModuleGrid /></Reveal>
      {isLoading && <Skeleton className="h-48 rounded-2xl" />}
      {error && <DashboardError error={error} onRetry={() => refetch()} />}
      {data && <Reveal index={1}><NoticeList notices={notices} href="/staff/noticeboard" /></Reveal>}
    </div>
  );
}
