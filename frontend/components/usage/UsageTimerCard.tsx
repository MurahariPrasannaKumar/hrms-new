"use client";

import { Timer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatClock, useUsage, type UsageState } from "./UsageTracker";

/** Attendance unlocks for students after this much active time each day (must match the server). */
export const REQUIRED_SECONDS = 5 * 60;

const STATE_LABEL: Record<UsageState, string> = {
  running: "Running",
  hidden: "Paused · tab not in view",
  idle: "Paused · no activity",
  "other-tab": "Counting in another tab",
};

/** Live "time on EduSphere today" clock for the dashboard. */
export function UsageTimerCard() {
  const { user } = useAuth();
  const { seconds, state, tracking } = useUsage();
  if (!tracking) return null;
  const student = user?.role === "STUDENT";
  const left = Math.max(REQUIRED_SECONDS - seconds, 0);
  const progress = Math.min(seconds / REQUIRED_SECONDS, 1);

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Time on EduSphere today">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Time on EduSphere today</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight" aria-live="off">{formatClock(seconds)}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${state === "running" ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
            {STATE_LABEL[state]}
          </p>
        </div>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-100/70 text-orange-800"><Timer className="size-6" aria-hidden /></span>
      </div>
      {student && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Progress towards unlocking attendance">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {left > 0 ? `Attendance unlocks after 5 minutes of active time. ${formatClock(left).slice(3)} to go.` : "Attendance is unlocked for today."}
          </p>
        </div>
      )}
    </section>
  );
}
