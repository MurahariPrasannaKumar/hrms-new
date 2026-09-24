"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { listFor } from "@/lib/api/admin";

type Rec = Record<string, unknown>;

export interface TabColumn {
  key: string;
  header: string;
  value: (row: Rec) => unknown;
}

const at = (row: Rec, ...path: string[]) => path.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Rec)[k] : undefined), row);
export const nameOf = (row: Rec) => [row.firstName, row.lastName].filter(Boolean).join(" ") || String(row.name ?? row.title ?? row.id);

export const SCHOOL_TABS: Record<string, { path: string; empty: string; columns: TabColumn[] }> = {
  students: {
    path: "/students", empty: "No students in this school yet.",
    columns: [
      { key: "name", header: "Student", value: nameOf },
      { key: "admissionNumber", header: "Admission no.", value: (r) => r.admissionNumber },
      { key: "class", header: "Class", value: (r) => at(r, "class", "name") },
      { key: "status", header: "Status", value: (r) => r.status },
    ],
  },
  teachers: {
    path: "/teachers", empty: "No teachers in this school yet.",
    columns: [
      { key: "name", header: "Teacher", value: (r) => nameOf((r.user as Rec) ?? r) },
      { key: "employeeId", header: "Employee ID", value: (r) => r.employeeId },
      { key: "qualification", header: "Qualification", value: (r) => r.qualification },
    ],
  },
  classes: {
    path: "/classes", empty: "No classes defined yet.",
    columns: [
      { key: "name", header: "Class", value: (r) => r.name },
      { key: "level", header: "Level", value: (r) => r.level },
      { key: "students", header: "Students", value: (r) => at(r, "_count", "students") },
    ],
  },
  attendance: {
    path: "/attendance", empty: "No attendance has been recorded.",
    columns: [
      { key: "student", header: "Student", value: (r) => nameOf((r.student as Rec) ?? r) },
      { key: "status", header: "Status", value: (r) => r.status },
      { key: "remark", header: "Remark", value: (r) => r.remark },
    ],
  },
  academics: {
    path: "/subjects", empty: "No subjects defined yet.",
    columns: [
      { key: "name", header: "Subject", value: (r) => r.name },
      { key: "code", header: "Code", value: (r) => r.code },
    ],
  },
  notices: {
    path: "/notices", empty: "No notices published.",
    columns: [
      { key: "title", header: "Title", value: (r) => r.title },
      { key: "type", header: "Type", value: (r) => r.type },
      { key: "isPublished", header: "Published", value: (r) => (r.isPublished ? "Yes" : "No") },
    ],
  },
};

/** Read-only table for one school's data, scoped via ?schoolId= (super admin). */
export function SchoolResourceTab({ schoolId, tab }: { schoolId: string; tab: keyof typeof SCHOOL_TABS }) {
  const spec = SCHOOL_TABS[tab];
  const [page, setPage] = useState(1);
  const params = { schoolId, page, pageSize: 10 };
  const query = useQuery({ queryKey: ["school-tab", tab, params], queryFn: () => listFor(spec.path, params), placeholderData: (p) => p });

  const columns: Column<Rec>[] = spec.columns.map((c) => ({
    key: c.key,
    header: c.header,
    cell: (row) => String(c.value(row) ?? "—"),
  }));

  return (
    <DataTable
      columns={columns}
      data={query.data?.items}
      getRowId={(r) => String(r.id)}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      page={page}
      pageSize={10}
      total={query.data?.meta.total}
      onPageChange={setPage}
      emptyTitle={spec.empty}
    />
  );
}
