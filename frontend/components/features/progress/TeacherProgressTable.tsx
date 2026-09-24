"use client";

import { Button } from "@/components/ui/button";
import { DataTable, type Column, type SortState } from "@/components/tables/DataTable";
import type { TeacherProgressRow } from "@/lib/api/attendance-progress";
import { fmtWhen, PctCell } from "./parts";

interface Props {
  rows?: TeacherProgressRow[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  sort?: SortState;
  onSortChange: (s: SortState) => void;
  onSelect: (id: string) => void;
}

export function TeacherProgressTable({ rows, isLoading, error, onRetry, page, pageSize, total, onPageChange, sort, onSortChange, onSelect }: Props) {
  const columns: Column<TeacherProgressRow>[] = [
    {
      key: "name", header: "Teacher", sortable: true,
      cell: (r) => (
        <button type="button" className="text-left hover:underline" onClick={() => onSelect(r.teacherId)}>
          <span className="block font-medium">{r.name}</span>
          <span className="block text-xs text-muted-foreground">{r.email}</span>
        </button>
      ),
    },
    { key: "employeeId", header: "Employee ID", sortable: true },
    { key: "subjects", header: "Subjects", cell: (r) => (r.subjects.length ? r.subjects.join(", ") : "—") },
    { key: "classes", header: "Classes", cell: (r) => (r.classes.length ? (r.classes.length > 2 ? `${r.classes.slice(0, 2).join(", ")} +${r.classes.length - 2}` : r.classes.join(", ")) : "—") },
    { key: "attendancePct", header: "Check-in rate", cell: (r) => <PctCell value={r.attendancePct} /> },
    { key: "daysAttendanceMarked30d", header: "Roll calls (30d)", cell: (r) => r.daysAttendanceMarked30d },
    { key: "assignmentsCreated", header: "Assignments", cell: (r) => r.assignmentsCreated },
    { key: "diaryEntries30d", header: "Diary (30d)", cell: (r) => r.diaryEntries30d },
    { key: "lastActiveAt", header: "Last active", cell: (r) => fmtWhen(r.lastActiveAt) },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.teacherId}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      sort={sort}
      onSortChange={onSortChange}
      rowActions={(r) => <Button variant="ghost" size="sm" onClick={() => onSelect(r.teacherId)} aria-label={`View activity for ${r.name}`}>View</Button>}
      emptyTitle="No teachers found"
      emptyDescription="Teachers appear here once you create them from Users."
    />
  );
}
