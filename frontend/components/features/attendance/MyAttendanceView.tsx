"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, Flame, XCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/StatCard";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { FormField } from "@/components/forms/FormField";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Input } from "@/components/ui/input";
import { attendanceSelfApi, type MyAttendance } from "@/lib/api/attendance-progress";
import { useAuth } from "@/lib/auth";
import { toApiError } from "@/lib/api/client";
import { QueryBoundary } from "../shared";
import { AttendanceGauge } from "./AttendanceGauge";
import { attendanceMessage, LEVEL_COLOR, LEVEL_LABEL, levelFor, monthLabel } from "./attendance-utils";
import { CheckInCard } from "./CheckInCard";
import { MonthHeatmap } from "./MonthHeatmap";
import { TrendChart } from "./TrendChart";

const KEY = ["attendance", "me"] as const;
const TEACHER_KEY = ["attendance", "teacher", "me"] as const;
const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Student sees their own attendance and can check in; a parent sees one linked child (read-only).
 * With `mode="teacher"` the same view shows the signed-in teacher's own daily check-ins.
 */
export function MyAttendanceView({ mode = "student" }: { mode?: "student" | "teacher" }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const teacher = mode === "teacher";
  const [studentId, setStudentId] = useState<string | undefined>();
  const [month, setMonth] = useState<string | undefined>();
  const key = [...(teacher ? TEACHER_KEY : KEY), studentId, month] as const;

  const q = useQuery({ queryKey: key, queryFn: async (): Promise<MyAttendance> => {
      if (!teacher) return attendanceSelfApi.me({ studentId, month });
      const t = await attendanceSelfApi.teacherMe({ month });
      return { ...t, student: { id: user?.id ?? "", name: user ? `${user.firstName} ${user.lastName}` : "", class: null, section: null } };
    },
    placeholderData: keepPreviousData,
  });

  const checkIn = useMutation({
    mutationFn: teacher ? attendanceSelfApi.teacherCheckIn : attendanceSelfApi.checkIn,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["attendance"] });
      const prev = qc.getQueryData<MyAttendance>(key);
      if (prev) {
        qc.setQueryData<MyAttendance>(key, {
          ...prev,
          today: { ...prev.today, marked: true, status: "PRESENT", source: "SELF", canCheckIn: false, checkedInTime: nowTime(), reason: null },
        });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(toApiError(e).message);
    },
    onSuccess: () => toast.success(teacher ? "Checked in for today" : "Attendance marked. Have a great day!"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const d = q.data;
  const isParent = !!d?.children;
  const level = d ? levelFor(d.overall.percentage) : "good";

  return (
    <QueryBoundary loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} moduleName="Attendance">
      {d && (
        <div className="space-y-5">
          {isParent && d.children && (
            <div className="max-w-xs">
              <FormField id="child" label="Child">
                <NativeSelect
                  id="child"
                  value={d.student.id}
                  options={d.children.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(e) => { setStudentId(e.target.value); setMonth(undefined); }}
                />
              </FormField>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row lg:col-span-3" aria-label="Attendance summary">
              <AttendanceGauge percentage={d.overall.percentage} size={148} />
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">{d.student.name}{d.student.class ? ` · ${d.student.class}${d.student.section ? ` - ${d.student.section}` : ""}` : ""}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight" style={{ color: LEVEL_COLOR[level] }}>{LEVEL_LABEL[level]}</p>
                <p className="mt-1 text-sm text-muted-foreground">{attendanceMessage({ ...d.overall })}</p>
                <p className="mt-2 text-xs text-muted-foreground">{teacher ? "Working days (Mon-Fri) since your first check-in count; present and late days count as attended." : "Present and late days count as attended."}</p>
              </div>
            </section>
            <div className="lg:col-span-2">
              <CheckInCard subject={teacher ? "teacher" : "student"} today={d.today} onCheckIn={() => checkIn.mutate()} pending={checkIn.isPending} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Present" value={d.overall.present} icon={CheckCircle2} tint="emerald" />
            <StatCard label="Absent" value={d.overall.absent} icon={XCircle} tint="rose" />
            <StatCard label="Late" value={d.overall.late} icon={Clock} tint="amber" />
            <StatCard label="Excused" value={d.overall.excused} icon={ShieldCheck} tint="sky" />
            <StatCard label="Total days" value={d.overall.totalDays} icon={CalendarDays} tint="indigo" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Monthly calendar">
              <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-medium">{monthLabel(d.month.month, "long")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {d.month.totalDays ? `${d.month.percentage}% across ${d.month.totalDays} recorded days` : "No records this month"}
                  </p>
                </div>
                <div>
                  <label htmlFor="att-month" className="sr-only">Month</label>
                  <Input id="att-month" type="month" className="w-40" value={d.month.month} max={d.today.date.slice(0, 7)} onChange={(e) => setMonth(e.target.value || undefined)} />
                </div>
              </header>
              <MonthHeatmap month={d.month.month} days={d.month.days} today={d.today.date} />
            </section>
            <TrendChart trend={d.trend} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Streaks">
              <h3 className="font-medium">Streaks</h3>
              <div className="mt-4 flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-100/70 text-orange-800"><Flame className="size-6" aria-hidden /></span>
                <div>
                  <p className="text-3xl font-semibold tracking-tight">{d.streak.current}<span className="ml-1 text-sm font-normal text-muted-foreground">{d.streak.current === 1 ? "day" : "days"}</span></p>
                  <p className="text-sm text-muted-foreground">Current · longest {d.streak.longest}</p>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2" aria-label="Recent history">
              <h3 className="font-medium">Recent history</h3>
              {d.month.days.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nothing recorded in {monthLabel(d.month.month, "long")}.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {[...d.month.days].reverse().slice(0, 8).map((day) => (
                    <li key={day.date} className="flex items-center justify-between py-2 text-sm">
                      <span>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <StatusBadge status={day.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}
