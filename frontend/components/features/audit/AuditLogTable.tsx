"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SelectField } from "@/components/features/shared/SelectField";
import { FilterBar } from "@/components/forms/FilterBar";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Input } from "@/components/ui/input";
import { useListState } from "@/hooks/useListState";
import { securityApi, type AuditLogRow } from "@/lib/api/admin";
import { formatDateTime, personName } from "@/lib/admin-format";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "PUBLISH", "EXPORT", "REVOKE", "CHANGE_PASSWORD"];
const RESOURCES = ["AUTH", "USER", "SCHOOL", "STUDENT", "TEACHER", "ATTENDANCE", "NOTICE", "MODULE", "SCHOOL_MODULE", "SESSION", "REPORT"];

interface Props {
  /** Scope to one school (super admin only; ignored for school admins, whose scope the server enforces). */
  schoolId?: string;
}

export function AuditLogTable({ schoolId }: Props) {
  const list = useListState({ by: "createdAt", order: "desc" }, 15);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { ...list.params, ...(schoolId ? { schoolId } : {}), from: from || undefined, to: to ? `${to}T23:59:59` : undefined };
  const query = useQuery({ queryKey: ["audit-logs", params], queryFn: () => securityApi.auditLogs(params), placeholderData: (p) => p });

  const columns: Column<AuditLogRow>[] = [
    { key: "createdAt", header: "When", sortable: true, cell: (l) => formatDateTime(l.createdAt) },
    { key: "user", header: "User", cell: (l) => (l.user ? <span>{personName(l.user)}<span className="block text-xs text-muted-foreground">{l.user.email}</span></span> : "System") },
    { key: "action", header: "Action", sortable: true, cell: (l) => <span className="font-mono text-xs">{l.action}</span> },
    { key: "resource", header: "Resource", sortable: true, cell: (l) => <span>{l.resource}{l.resourceId && <span className="block max-w-40 truncate text-xs text-muted-foreground">{l.resourceId}</span>}</span> },
    { key: "ipAddress", header: "IP", cell: (l) => l.ipAddress ?? "—" },
  ];

  return (
    <>
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search by user email">
        <SelectField aria-label="Filter by action" value={list.filters.action ?? ""} onChange={(e) => list.setFilter("action", e.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </SelectField>
        <SelectField aria-label="Filter by resource" value={list.filters.resource ?? ""} onChange={(e) => list.setFilter("resource", e.target.value)}>
          <option value="">All resources</option>
          {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
        </SelectField>
        <Input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); list.setPage(1); }} className="h-10 w-40 rounded-xl" />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); list.setPage(1); }} className="h-10 w-40 rounded-xl" />
      </FilterBar>
      <DataTable
        columns={columns}
        data={query.data?.items}
        getRowId={(l) => l.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={query.data?.meta.total}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        emptyTitle="No audit entries"
        emptyDescription="Nothing matches these filters."
      />
    </>
  );
}
