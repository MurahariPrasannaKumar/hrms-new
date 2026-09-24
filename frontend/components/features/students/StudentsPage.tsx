"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FilterBar } from "@/components/forms/FilterBar";
import { FormModal } from "@/components/forms/FormModal";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useClasses } from "@/hooks/useLookups";
import { useListState } from "@/hooks/useListState";
import { toApiError } from "@/lib/api/client";
import { parentsApi, studentsApi, type StudentInput, type StudentRow } from "@/lib/api/people";
import { fullName } from "@/lib/format";
import { useCan } from "../shared";
import { StudentForm } from "./StudentForm";

function useParentOptions(enabled: boolean) {
  const q = useQuery({ queryKey: ["parents"], queryFn: () => parentsApi.list(), enabled, staleTime: 60_000 });
  return q.data ?? [];
}

export function StudentsPage({ basePath }: { basePath: string }) {
  const can = useCan();
  const qc = useQueryClient();
  const list = useListState({ by: "createdAt", order: "desc" });
  const classes = useClasses();
  const parents = useParentOptions(can("students.create") || can("students.update"));
  const [editing, setEditing] = useState<StudentRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);

  const query = useQuery({ queryKey: ["students", list.params], queryFn: () => studentsApi.list(list.params), placeholderData: (p) => p });

  const save = useMutation({
    mutationFn: (v: StudentInput) => (editing && editing !== "new" ? studentsApi.update(editing.id, v) : studentsApi.create(v)),
    onSuccess: () => {
      toast.success(editing === "new" ? "Student added" : "Student updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      toast.success("Student removed");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const classOptions = classes.data ?? [];
  const sectionOptions = classOptions.find((c) => c.id === list.filters.classId)?.sections ?? [];

  const columns: Column<StudentRow>[] = [
    { key: "admissionNumber", header: "Adm. no.", sortable: true },
    {
      key: "firstName", header: "Name", sortable: true,
      cell: (s) => <Link href={`${basePath}/${s.id}`} className="font-medium hover:underline focus-visible:underline">{fullName(s)}</Link>,
    },
    { key: "class", header: "Class", cell: (s) => (s.class ? `${s.class.name}${s.section ? ` · ${s.section.name}` : ""}` : "—") },
    { key: "parent", header: "Parent", cell: (s) => (s.parent ? fullName(s.parent.user) : "—") },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Students"
        description="Manage admissions, class assignments and student records."
        actions={can("students.create") && (
          <Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> Add student</Button>
        )}
      />
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search name or admission no.">
        <NativeSelect aria-label="Filter by class" className="w-40" placeholder="All classes" value={list.filters.classId ?? ""}
          options={classOptions.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(e) => { list.setFilter("classId", e.target.value); list.setFilter("sectionId", ""); }} />
        <NativeSelect aria-label="Filter by section" className="w-36" placeholder="All sections" disabled={!list.filters.classId}
          value={list.filters.sectionId ?? ""} options={sectionOptions.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => list.setFilter("sectionId", e.target.value)} />
        <NativeSelect aria-label="Filter by status" className="w-40" placeholder="All statuses" value={list.filters.status ?? ""}
          options={["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
          onChange={(e) => list.setFilter("status", e.target.value)} />
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
        emptyTitle="No students found"
        emptyDescription="Try changing the search or filters."
        rowActions={(s) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fullName(s)}`} />}>
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`${basePath}/${s.id}`} />}><Eye className="size-4" aria-hidden /> View profile</DropdownMenuItem>
              {can("students.update") && <DropdownMenuItem onClick={() => setEditing(s)}><Pencil className="size-4" aria-hidden /> Edit</DropdownMenuItem>}
              {can("students.delete") && <DropdownMenuItem variant="destructive" onClick={() => setDeleting(s)}><Trash2 className="size-4" aria-hidden /> Remove</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <FormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add student" : "Edit student"}>
        {editing && (
          <StudentForm
            classes={classOptions}
            parents={parents}
            initial={editing === "new" ? undefined : editing}
            submitting={save.isPending}
            onSubmit={(v) => save.mutate(v)}
            onCancel={() => setEditing(null)}
          />
        )}
      </FormModal>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove student?"
        description={deleting ? `${fullName(deleting)} will be removed. This can't be undone.` : undefined}
        confirmLabel="Remove"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
