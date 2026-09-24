"use client";

import { useState } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, RosterStudent } from "@/lib/api/people";

export const STATUSES: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "PRESENT", label: "Present", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "ABSENT", label: "Absent", active: "bg-rose-600 text-white border-rose-600" },
  { value: "LATE", label: "Late", active: "bg-amber-500 text-white border-amber-500" },
  { value: "EXCUSED", label: "Excused", active: "bg-sky-600 text-white border-sky-600" },
];

export interface MarkRecord { studentId: string; status: AttendanceStatus }

interface Props {
  students: RosterStudent[];
  saving?: boolean;
  onSave: (records: MarkRecord[]) => void;
}

/** Roster with per-student status toggles and bulk actions. Parent should remount (key) when section/date change. */
export function RosterMarker({ students, saving, onSave }: Props) {
  const [status, setStatus] = useState<Record<string, AttendanceStatus>>(() => Object.fromEntries(students.map((s) => [s.id, s.status])));

  if (!students.length) return <div className="rounded-2xl border bg-card"><EmptyState title="No students in this section" description="Add students to the section before taking attendance." /></div>;

  const setAll = (value: AttendanceStatus) => setStatus(Object.fromEntries(students.map((s) => [s.id, value])));
  const counts = STATUSES.map((st) => ({ ...st, n: students.filter((s) => status[s.id] === st.value).length }));

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")}>Mark all present</Button>
        <Button variant="outline" size="sm" onClick={() => setAll("ABSENT")}>Mark all absent</Button>
        <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {counts.map((c) => `${c.n} ${c.label.toLowerCase()}`).join(" · ")}
        </p>
      </div>
      <ul className="divide-y">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.firstName} {s.lastName}</p>
              <p className="text-xs text-muted-foreground">{s.admissionNumber}</p>
            </div>
            <div role="group" aria-label={`Attendance for ${s.firstName} ${s.lastName}`} className="flex gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  aria-pressed={status[s.id] === st.value}
                  onClick={() => setStatus((p) => ({ ...p, [s.id]: st.value }))}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    status[s.id] === st.value ? st.active : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t p-4">
        <Button disabled={saving} onClick={() => onSave(students.map((s) => ({ studentId: s.id, status: status[s.id] })))}>
          {saving ? "Saving…" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}
