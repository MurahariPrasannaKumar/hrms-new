"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "./ChartCard";
import type { ActivityRow, NoticeBrief, TrendPoint } from "@/lib/api/dashboard";
import type { ActivityItem } from "./RecentActivity";

export const COLORS = { primary: "#c96442", teal: "#7a9e7e", amber: "#d9a441", rose: "#c4566b", sky: "#6c8fb5" };

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const relTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const toActivity = (rows: ActivityRow[]): ActivityItem[] =>
  rows.map((r) => ({
    id: r.id,
    title: `${r.user ?? "System"} · ${r.action.toLowerCase().replace(/_/g, " ")}`,
    description: r.resource.toLowerCase(),
    time: relTime(r.createdAt),
  }));

/** Staggered entrance for dashboard sections. */
export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.25 }}>
      {children}
    </motion.div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
    </div>
  );
}

export function DashboardError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <ErrorState title="Couldn’t load dashboard data" error={error} onRetry={onRetry} />;
}

export function AttendanceTrendChart({ data, title = "Attendance trend" }: { data: TrendPoint[]; title?: string }) {
  if (!data.length) {
    return (
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="font-medium">{title}</h3>
        <EmptyState compact title="No attendance yet" description="Marked attendance will chart here." />
      </section>
    );
  }
  return (
    <ChartCard title={title} description="Present or late, last 14 days">
      <LineChart data={data} margin={{ left: -16, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
        <YAxis domain={[0, 100]} unit="%" fontSize={12} />
        <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [`${v}%`, "Attendance"]} />
        <Line type="monotone" dataKey="presentPct" stroke={COLORS.teal} strokeWidth={2} dot={false} />
      </LineChart>
    </ChartCard>
  );
}

export function NoticeList({ notices, href, title = "Recent notices" }: { notices: NoticeBrief[]; href?: string; title?: string }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label={title}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        {href && <Link href={href} className="text-sm text-primary hover:underline">View all</Link>}
      </div>
      {!notices.length ? (
        <EmptyState compact title="No notices" description="Published notices will appear here." />
      ) : (
        <ul className="space-y-3">
          {notices.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{n.title}</p>
                <time className="text-xs text-muted-foreground">{relTime(n.createdAt)}</time>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{n.type}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
