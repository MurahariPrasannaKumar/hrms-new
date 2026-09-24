"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FormModal } from "@/components/forms/FormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { toApiError } from "@/lib/api/client";
import { diaryService, type DiaryInput, type DiaryRow } from "@/lib/api/learning-ai";
import { formatDate, QueryBoundary, useCan } from "../shared";
import { DiaryForm } from "./DiaryForm";

export function DiaryPage() {
  const can = useCan();
  const canManage = can("diary.manage");
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<DiaryRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DiaryRow | null>(null);

  const query = useQuery({
    queryKey: ["diary", filter, page],
    queryFn: () => diaryService.list({ page, pageSize: 10, isHomework: filter || undefined }),
  });

  const complete = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => diaryService.setCompleted(id, completed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diary"] }),
    onError: (e) => toast.error(toApiError(e).message),
  });

  const save = useMutation({
    mutationFn: (input: DiaryInput) =>
      editing && editing !== "new"
        ? diaryService.update(editing.id, { title: input.title, body: input.body, subjectId: input.subjectId, isHomework: input.isHomework, dueDate: input.dueDate ?? null })
        : diaryService.create(input),
    onSuccess: () => {
      toast.success(editing === "new" ? "Diary entry created" : "Diary entry updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["diary"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => diaryService.remove(id),
    onSuccess: () => {
      toast.success("Diary entry deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["diary"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div>
      <PageHeader
        title="Digital Diary"
        description={canManage ? "Share notes and homework with your classes." : "Notes and homework from your teachers."}
        actions={canManage && <Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> New entry</Button>}
      />
      <div className="mb-4 max-w-48">
        <label htmlFor="diary-filter" className="sr-only">Filter entries</label>
        <NativeSelect id="diary-filter" value={filter} onChange={(e) => { setFilter(e.target.value as typeof filter); setPage(1); }}>
          <option value="">All entries</option>
          <option value="true">Homework only</option>
          <option value="false">Notes only</option>
        </NativeSelect>
      </div>

      <QueryBoundary
        loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} moduleName="Digital Diary"
        empty={items.length === 0} emptyTitle="No diary entries" emptyDescription={canManage ? "Create the first entry for your class." : "Nothing has been shared yet."}
      >
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id}>
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-medium">{e.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {[e.class?.name, e.section?.name && `Section ${e.section.name}`, e.subject?.name].filter(Boolean).join(" · ")} · {formatDate(e.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.isHomework && <StatusBadge status="homework" />}
                      {canManage && (
                        <>
                          <Button size="icon" variant="ghost" aria-label={`Edit ${e.title}`} onClick={() => setEditing(e)}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={`Delete ${e.title}`} onClick={() => setDeleting(e)}><Trash2 className="size-4" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{e.body}</p>
                  {e.isHomework && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="size-4" aria-hidden /> Due {formatDate(e.dueDate)}</span>
                      {!canManage && (
                        <Button size="sm" variant={e.completed ? "secondary" : "outline"} aria-pressed={e.completed} disabled={complete.isPending} onClick={() => complete.mutate({ id: e.id, completed: !e.completed })}>
                          {e.completed ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <Circle className="size-4" aria-hidden />}
                          {e.completed ? "Completed" : "Mark complete"}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </QueryBoundary>

      <FormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New diary entry" : "Edit diary entry"}>
        {editing && <DiaryForm initial={editing === "new" ? undefined : editing} submitting={save.isPending} onSubmit={(v) => save.mutate(v)} />}
      </FormModal>
      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this entry?"
        description="Students and parents will no longer see it." confirmLabel="Delete" onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
