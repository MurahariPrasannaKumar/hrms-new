"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { DataTable } from "@/components/tables/DataTable";
import { useListState } from "@/hooks/useListState";
import { attendanceRosterApi, type AttendanceEntry, type AttendanceSummary } from "@/lib/api/people";
import { fmtDate, fullName } from "@/lib/format";
import { QueryBoundary } from "../shared";

const COLORS = { PRESENT: "#6f9a6f", ABSENT: "#c4566b", LATE: "#d9a441", EXCUSED: "#6c8fb5" } as const;

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

export function SummaryPanel({ summary, loading, error, onRetry }: { summary?: AttendanceSummary; loading?: boolean; error?: unknown; onRetry?: () => void }) {
  const data = summary ? (Object.keys(COLORS) as (keyof typeof COLORS)[]).map((k) => ({ name: k.charAt(0) + k.slice(1).toLowerCase(), key: k, value: summary.counts[k] })) : [];
  return (
    <QueryBoundary loading={loading} error={error} onRetry={onRetry} empty={!!summary && summary.total === 0} emptyTitle="No attendance recorded" emptyDescription="Nothing has been marked for this selection yet.">
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Attendance rate" value={`${summary.percentage}%`} />
            <StatCard label="Present" value={summary.counts.PRESENT} />
            <StatCard label="Absent" value={summary.counts.ABSENT} />
            <StatCard label="Late / excused" value={summary.counts.LATE + summary.counts.EXCUSED} />
          </div>
          <ChartCard title="Status breakdown" description={`${summary.total} records${summary.month ? ` in ${summary.month}` : ""}`} height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{data.map((d) => <Cell key={d.key} fill={COLORS[d.key]} />)}</Bar>
            </BarChart>
          </ChartCard>
        </div>
      )}
    </QueryBoundary>
  );
}

interface Props { sectionId?: string; studentId?: string; month?: string }

/** Summary + paginated history for a section / student / month. */
export function AttendanceReport({ sectionId, studentId, month }: Props) {
  const list = useListState(undefined, 10);
  const range = month ? monthRange(month) : {};
  const summary = useQuery({ queryKey: ["attendance", "summary", sectionId, studentId, month], queryFn: () => attendanceRosterApi.summary({ sectionId, studentId, month }) });
  const history = useQuery({
    queryKey: ["attendance", "list", sectionId, studentId, month, list.page],
    queryFn: () => attendanceRosterApi.list({ page: list.page, pageSize: list.pageSize, sectionId, studentId, ...range }),
    placeholderData: (p) => p,
  });
  return (
    <div className="space-y-4">
      <SummaryPanel summary={summary.data} loading={summary.isLoading} error={summary.error} onRetry={() => summary.refetch()} />
      <DataTable<AttendanceEntry>
        columns={[
          { key: "date", header: "Date", cell: (r) => fmtDate(r.attendance.date) },
          { key: "student", header: "Student", cell: (r) => fullName(r.student) },
          { key: "adm", header: "Adm. no.", cell: (r) => r.student.admissionNumber },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
        data={history.data?.items}
        getRowId={(r) => r.id}
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={history.data?.meta.total}
        onPageChange={list.setPage}
        emptyTitle="No attendance history"
      />
    </div>
  );
}
