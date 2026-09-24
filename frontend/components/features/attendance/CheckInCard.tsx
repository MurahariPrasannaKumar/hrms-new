"use client";

import { CheckCircle2, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, useUsage } from "@/components/usage/UsageTracker";
import type { TodayState } from "@/lib/api/attendance-progress";

interface Props {
  today: TodayState;
  onCheckIn: () => void;
  pending?: boolean;
  /** "student" wording by default. */
  subject?: "student" | "teacher";
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

/** Today's attendance: can check in / already marked / not available (with reason). */
export function CheckInCard({ today, onCheckIn, pending, subject = "student" }: Props) {
  const { seconds } = useUsage();
  const required = today.requiredSeconds ?? 300;
  const waiting = today.lockedBy === "usage";
  const teacherMarked = today.marked && today.source === "TEACHER";
  return (
    <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm" aria-label="Today's attendance">
      <div>
        <p className="text-sm text-muted-foreground">Today · {dateLabel(today.date)}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {today.marked ? "Attendance recorded" : today.canCheckIn ? (subject === "teacher" ? "Check in for today" : "Mark my attendance") : "Not available"}
        </h2>
      </div>

      {today.marked ? (
        <div className="flex items-start gap-3 rounded-xl bg-accent p-3 text-accent-foreground" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm">
            {teacherMarked
              ? <>Marked <strong className="capitalize">{today.status?.toLowerCase()}</strong> by your teacher.</>
              : <>You checked in{today.checkedInTime ? <> at <strong>{today.checkedInTime}</strong></> : null}
                {today.status && today.status !== "PRESENT" ? <> — currently <strong className="capitalize">{today.status.toLowerCase()}</strong></> : null}.</>}
          </p>
        </div>
      ) : today.canCheckIn ? (
        <Button size="lg" className="h-12 rounded-xl text-base" onClick={onCheckIn} disabled={pending}>
          <Clock className="size-5" aria-hidden />
          {pending ? "Marking…" : subject === "teacher" ? "Check in now" : "Mark me present"}
        </Button>
      ) : waiting ? (
        <div className="rounded-xl bg-muted p-3 text-sm" role="status">
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground">Keep EduSphere open to unlock attendance.</p>
            <p className="font-mono font-medium tabular-nums">{formatClock(Math.max(required - seconds, 0)).slice(3)} left</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuemin={0} aria-valuemax={required} aria-valuenow={Math.min(seconds, required)} aria-label="Active time today">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(seconds / required, 1) * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground" role="status">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{today.reason ?? "Attendance cannot be marked right now."}</p>
        </div>
      )}
    </section>
  );
}
