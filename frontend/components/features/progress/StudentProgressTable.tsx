"use client";

import { Button } from "@/components/ui/button";
import { DataTable, type Column, type SortState } from "@/components/tables/DataTable";
import type { StudentProgressRow } from "@/lib/api/attendance-progress";
import { PctCell, RiskBadge } from "./parts";

interface Props {
  rows?: StudentProgressRow[];
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

export function StudentProgressTable({ rows, isLoading, error, onRetry, page, pageSize, total, onPageChange, sort, onSortChange, onSelect }: Props) {
  const columns: Column<StudentProgressRow>[] = [
    {
      key: "name", header: "Student", sortable: true,
      cell: (r) => (
        <button type="button" className="text-left hover:underline" onClick={() => onSelect(r.studentId)}>
          <span className="block font-medium">{r.name}</span>
          <span className="block text-xs text-muted-foreground">{r.admissionNumber}</span>
        </button>
      ),
    },
    { key: "class", header: "Class", sortable: true, cell: (r) => (r.class ? `${r.class}${r.section ? ` - ${r.section}` : ""}` : "—") },
    { key: "attendancePct", header: "Attendance", sortable: true, cell: (r) => <PctCell value={r.attendancePct} /> },
    { key: "avgExamPct", header: "Exam avg", sortable: true, cell: (r) => <PctCell value={r.avgExamPct} kind="exam" /> },
    { key: "assignmentsSubmitted", header: "Assignments", sortable: true, cell: (r) => `${r.assignmentsSubmitted}/${r.assignmentsTotal}` },
    { key: "lessonsCompleted", header: "Lessons", sortable: true, cell: (r) => r.lessonsCompleted },
    { key: "riskLevel", header: "Status", sortable: true, cell: (r) => <RiskBadge risk={r.riskLevel} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.studentId}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      sort={sort}
      onSortChange={onSortChange}
      rowActions={(r) => <Button variant="ghost" size="sm" onClick={() => onSelect(r.studentId)} aria-label={`View progress for ${r.name}`}>View</Button>}
      emptyTitle="No students found"
      emptyDescription="Try a different search or filter. Students appear here once they are added and assigned to a class."
    />
  );
}
