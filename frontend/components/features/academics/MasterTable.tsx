"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FormModal } from "@/components/forms/FormModal";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { useListState } from "@/hooks/useListState";
import { toApiError, type ListParams, type Paged } from "@/lib/api/client";
import { FieldsForm, type FieldDef } from "./FieldsForm";

type Values = Record<string, string | boolean>;

interface Props<Row extends { id: string }> {
  entity: string;
  queryKey: string;
  list: (params: ListParams) => Promise<Paged<Row>>;
  create?: (v: Values) => Promise<unknown>;
  update?: (id: string, v: Values) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
  columns: Column<Row>[];
  fields: FieldDef[] | ((row: Row | null) => FieldDef[]);
  toInitial?: (row: Row) => Values;
  canManage: boolean;
  extraActions?: (row: Row) => ReactNode;
}

/** List + create/edit/delete for a simple master-data resource. Read-only when `canManage` is false. */
export function MasterTable<Row extends { id: string }>({ entity, queryKey, list, create, update, remove, columns, fields, toInitial, canManage, extraActions }: Props<Row>) {
  const qc = useQueryClient();
  const state = useListState(undefined, 10);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const query = useQuery({ queryKey: [queryKey, state.params], queryFn: () => list(state.params), placeholderData: (p) => p });

  const finish = (msg: string) => () => {
    toast.success(msg);
    setEditing(null);
    setDeleting(null);
    qc.invalidateQueries({ queryKey: [queryKey] });
    qc.invalidateQueries({ queryKey: ["lookup"] });
  };
  const onError = (e: unknown) => toast.error(toApiError(e).message);
  const save = useMutation({
    mutationFn: (v: Values) => (editing && editing !== "new" ? update!(editing.id, v) : create!(v)),
    onSuccess: finish(`${entity} saved`),
    onError,
  });
  const del = useMutation({ mutationFn: (id: string) => remove!(id), onSuccess: finish(`${entity} deleted`), onError });

  const row = editing && editing !== "new" ? editing : null;
  const defs = typeof fields === "function" ? fields(row) : fields;
  const withActions = canManage && (update || remove);

  return (
    <div className="space-y-3">
      {canManage && create && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> Add {entity.toLowerCase()}</Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={query.data?.items}
        getRowId={(r) => r.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        page={state.page}
        pageSize={state.pageSize}
        total={query.data?.meta.total}
        onPageChange={state.setPage}
        emptyTitle={`No ${entity.toLowerCase()} records yet`}
        rowActions={
          withActions || extraActions
            ? (r) => (
                <div className="flex justify-end gap-1">
                  {extraActions?.(r)}
                  {canManage && update && <Button variant="ghost" size="icon-sm" aria-label={`Edit ${entity.toLowerCase()}`} onClick={() => setEditing(r)}><Pencil className="size-4" aria-hidden /></Button>}
                  {canManage && remove && <Button variant="ghost" size="icon-sm" aria-label={`Delete ${entity.toLowerCase()}`} onClick={() => setDeleting(r)}><Trash2 className="size-4" aria-hidden /></Button>}
                </div>
              )
            : undefined
        }
      />
      <FormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? `Add ${entity.toLowerCase()}` : `Edit ${entity.toLowerCase()}`}>
        {editing && (
          <FieldsForm fields={defs} initial={row && toInitial ? toInitial(row) : undefined} submitting={save.isPending} onSubmit={(v) => save.mutate(v)} onCancel={() => setEditing(null)} />
        )}
      </FormModal>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${entity.toLowerCase()}?`}
        description="This can't be undone and may fail if other records depend on it."
        confirmLabel="Delete"
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}
