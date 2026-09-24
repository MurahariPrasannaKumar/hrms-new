"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FormModal } from "@/components/forms/FormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { toApiError } from "@/lib/api/client";
import { noticeService, type NoticeInput, type NoticeRow } from "@/lib/api/learning-ai";
import { formatDate, QueryBoundary, useCan } from "../shared";
import { NOTICE_TYPES, NoticeForm } from "./NoticeForm";

const stateOf = (n: NoticeRow) => {
  const now = Date.now();
  if (!n.isPublished) return "draft";
  if (n.publishAt && new Date(n.publishAt).getTime() > now) return "scheduled";
  if (n.expiresAt && new Date(n.expiresAt).getTime() <= now) return "expired";
  return "published";
};

export function NoticesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<NoticeRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<NoticeRow | null>(null);

  const query = useQuery({
    queryKey: ["notices", type, status, page],
    queryFn: () => noticeService.list({ page, pageSize: 10, type: type || undefined, status: status || undefined }),
  });
  const save = useMutation({
    mutationFn: (input: NoticeInput) => (editing && editing !== "new" ? noticeService.update(editing.id, input) : noticeService.create(input)),
    onSuccess: (_r, input) => { toast.success(editing === "new" && input.publish && !input.publishAt ? "Notice published. Everyone in the audience is being notified by email." : "Notice saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["notices"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => noticeService.remove(id),
    onSuccess: () => { toast.success("Notice deleted"); setDeleting(null); qc.invalidateQueries({ queryKey: ["notices"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div>
      <PageHeader
        title="Noticeboard"
        description="Announcements, events and updates."
        actions={can("notices.create") && <Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> New notice</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-44">
          <label htmlFor="n-f-type" className="sr-only">Type</label>
          <NativeSelect id="n-f-type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            {NOTICE_TYPES.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
          </NativeSelect>
        </div>
        {can("notices.create") && (
          <div className="w-44">
            <label htmlFor="n-f-status" className="sr-only">Status</label>
            <NativeSelect id="n-f-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Any status</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
            </NativeSelect>
          </div>
        )}
      </div>

      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} moduleName="Noticeboard" empty={items.length === 0} emptyTitle="No notices" emptyDescription="Nothing to show for these filters.">
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-medium">{n.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(n.publishAt ?? n.createdAt)}{n.expiresAt ? ` · expires ${formatDate(n.expiresAt)}` : ""}
                        {n.targets.length ? ` · targeted` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={n.type} />
                      {can("notices.update") && <StatusBadge status={stateOf(n)} />}
                      {can("notices.update") && <Button size="icon" variant="ghost" aria-label={`Edit ${n.title}`} onClick={() => setEditing(n)}><Pencil className="size-4" /></Button>}
                      {can("notices.delete") && <Button size="icon" variant="ghost" aria-label={`Delete ${n.title}`} onClick={() => setDeleting(n)}><Trash2 className="size-4" /></Button>}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
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

      <FormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New notice" : "Edit notice"}>
        {editing && <NoticeForm initial={editing === "new" ? undefined : editing} submitting={save.isPending} onSubmit={(v) => save.mutate(v)} />}
      </FormModal>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this notice?" confirmLabel="Delete" onConfirm={() => deleting && remove.mutate(deleting.id)} />
    </div>
  );
}
