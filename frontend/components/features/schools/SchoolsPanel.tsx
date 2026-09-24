"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Pencil, Plus, Power } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FilterBar } from "@/components/forms/FilterBar";
import { SelectField } from "@/components/features/shared/SelectField";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { adminSchoolApi, type SchoolRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/admin-format";
import { useListState } from "@/hooks/useListState";
import { SchoolFormModal } from "./SchoolFormModal";

export function SchoolsPanel() {
  const qc = useQueryClient();
  const list = useListState({ by: "createdAt", order: "desc" });
  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toggling, setToggling] = useState<SchoolRow | null>(null);

  const query = useQuery({
    queryKey: ["schools", list.params],
    queryFn: () => adminSchoolApi.list(list.params),
    placeholderData: (prev) => prev,
  });

  const setStatus = useMutation({
    mutationFn: (s: SchoolRow) => adminSchoolApi.update(s.id, { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    onSuccess: () => {
      toast.success("School status updated");
      qc.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const columns: Column<SchoolRow>[] = [
    {
      key: "name", header: "School", sortable: true,
      cell: (s) => (
        <Link href={`/admin/schools/${s.id}`} className="font-medium hover:underline">
          {s.name}
          <span className="block text-xs font-normal text-muted-foreground">{s.code}</span>
        </Link>
      ),
    },
    { key: "city", header: "Location", cell: (s) => [s.city, s.country].filter(Boolean).join(", ") || "—" },
    { key: "principal", header: "Principal", cell: (s) => s.principal ?? "—" },
    { key: "students", header: "Students", cell: (s) => s._count?.students ?? 0 },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
    { key: "createdAt", header: "Created", sortable: true, cell: (s) => formatDate(s.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Schools"
        description="Manage every school on the platform."
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4" /> Add school</Button>}
      />
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search schools by name or code">
        <SelectField aria-label="Filter by status" value={list.filters.status ?? ""} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectField>
      </FilterBar>
      <DataTable
        columns={columns}
        data={query.data?.items}
        getRowId={(s) => s.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={query.data?.meta.total}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        emptyTitle="No schools found"
        emptyDescription="Try a different search or add a school."
        rowActions={(s) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${s.name}`} />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/admin/schools/${s.id}`} />}><Eye className="size-4" /> View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="size-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setToggling(s)}>
                <Power className="size-4" /> {s.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <SchoolFormModal open={formOpen} onOpenChange={setFormOpen} school={editing} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === "ACTIVE" ? "Deactivate school?" : "Activate school?"}
        description={toggling?.status === "ACTIVE" ? "Users of this school will no longer be able to sign in." : "Users of this school will be able to sign in again."}
        confirmLabel={toggling?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        onConfirm={() => toggling && setStatus.mutate(toggling)}
      />
    </>
  );
}
