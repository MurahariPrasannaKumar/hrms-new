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
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useListState } from "@/hooks/useListState";
import { toApiError } from "@/lib/api/client";
import { teachersApi, type TeacherCreate, type TeacherRow } from "@/lib/api/people";
import { fullName } from "@/lib/format";
import { useCan } from "../shared";
import { TeacherForm } from "./TeacherForm";

export function TeachersPage({ basePath }: { basePath: string }) {
  const can = useCan();
  const qc = useQueryClient();
  const list = useListState({ by: "createdAt", order: "desc" });
  const [editing, setEditing] = useState<TeacherRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TeacherRow | null>(null);

  const query = useQuery({ queryKey: ["teachers", list.params], queryFn: () => teachersApi.list(list.params), placeholderData: (p) => p });

  const done = (msg: string) => () => {
    toast.success(msg);
    setEditing(null);
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["teachers"] });
  };
  const onError = (e: unknown) => toast.error(toApiError(e).message);

  const save = useMutation({
    mutationFn: (v: TeacherCreate) => {
      if (editing && editing !== "new") {
        const { email: _e, password: _p, ...rest } = v;
        void _e; void _p;
        return teachersApi.update(editing.id, rest);
      }
      return teachersApi.create(v);
    },
    onSuccess: done("Teacher saved"),
    onError,
  });
  const remove = useMutation({ mutationFn: (id: string) => teachersApi.remove(id), onSuccess: done("Teacher removed"), onError });

  const columns: Column<TeacherRow>[] = [
    { key: "employeeId", header: "Employee ID", sortable: true },
    {
      key: "name", header: "Name",
      cell: (t) => (
        <div>
          <Link href={`${basePath}/${t.id}`} className="font-medium hover:underline focus-visible:underline">{fullName(t.user)}</Link>
          <p className="text-xs text-muted-foreground">{t.user.email}</p>
        </div>
      ),
    },
    { key: "subjects", header: "Subjects", cell: (t) => (t.subjects.length ? t.subjects.map((s) => s.subject.name).join(", ") : "—") },
    { key: "classes", header: "Sections", cell: (t) => t._count.classes },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.user.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Teachers"
        description="Manage teaching staff, subjects and class assignments."
        actions={can("teachers.create") && <Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> Add teacher</Button>}
      />
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search teachers" />
      <DataTable
        columns={columns}
        data={query.data?.items}
        getRowId={(t) => t.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={query.data?.meta.total}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        emptyTitle="No teachers found"
        rowActions={(t) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fullName(t.user)}`} />}>
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`${basePath}/${t.id}`} />}><Eye className="size-4" aria-hidden /> View profile</DropdownMenuItem>
              {can("teachers.update") && <DropdownMenuItem onClick={() => setEditing(t)}><Pencil className="size-4" aria-hidden /> Edit</DropdownMenuItem>}
              {can("teachers.delete") && <DropdownMenuItem variant="destructive" onClick={() => setDeleting(t)}><Trash2 className="size-4" aria-hidden /> Remove</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <FormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add teacher" : "Edit teacher"}>
        {editing && (
          <TeacherForm initial={editing === "new" ? undefined : editing} submitting={save.isPending} onSubmit={(v) => save.mutate(v)} onCancel={() => setEditing(null)} />
        )}
      </FormModal>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove teacher?"
        description={deleting ? `${fullName(deleting.user)} and their login will be permanently deleted, including their assignments and diary entries.` : undefined}
        confirmLabel="Remove"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
