"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Eye, Paperclip, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FormModal } from "@/components/forms/FormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api/client";
import { assignmentService, fileService, type AssignmentInput, type AssignmentRow } from "@/lib/api/learning-ai";
import { formatDate, QueryBoundary, useCan } from "../shared";
import { AssignmentForm } from "./AssignmentForm";

function SubmissionsDialog({ assignment, onClose }: { assignment: AssignmentRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["assignment-submissions", assignment?.id],
    queryFn: () => assignmentService.submissions(assignment!.id),
    enabled: !!assignment,
  });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const grade = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => assignmentService.grade(assignment!.id, id, value),
    onSuccess: () => { toast.success("Marks saved"); qc.invalidateQueries({ queryKey: ["assignment-submissions"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });
  return (
    <FormModal open={!!assignment} onOpenChange={(o) => !o && onClose()} title={`Submissions: ${assignment?.title ?? ""}`}>
      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} empty={(query.data ?? []).length === 0} emptyTitle="No submissions yet">
        <ul className="space-y-3">
          {query.data?.map((s) => (
            <li key={s.id} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{s.student ? `${s.student.firstName} ${s.student.lastName}` : "Student"}</p>
              <p className="text-xs text-muted-foreground">Submitted {formatDate(s.submittedAt)}</p>
              {s.content && <p className="mt-2 whitespace-pre-wrap">{s.content}</p>}
              {s.fileId && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => fileService.open(s.fileId!).catch((e) => toast.error(toApiError(e).message))}>
                  <Paperclip className="size-3.5" aria-hidden /> Attachment
                </Button>
              )}
              <div className="mt-2 flex items-end gap-2">
                <div>
                  <Label htmlFor={`marks-${s.id}`} className="text-xs">Marks</Label>
                  <Input id={`marks-${s.id}`} type="number" min={0} className="w-24" value={marks[s.id] ?? (s.marks ?? "")} onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })} />
                </div>
                <Button size="sm" disabled={marks[s.id] === undefined || marks[s.id] === "" || grade.isPending} onClick={() => grade.mutate({ id: s.id, value: Number(marks[s.id]) })}>Save</Button>
              </div>
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </FormModal>
  );
}

function SubmitDialog({ assignment, onClose }: { assignment: AssignmentRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      const fileId = file ? (await fileService.upload(file)).id : undefined;
      return assignmentService.submit(assignment!.id, { content: content || undefined, fileId });
    },
    onSuccess: () => { toast.success("Submitted"); setContent(""); setFile(null); onClose(); qc.invalidateQueries({ queryKey: ["assignments"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });
  return (
    <FormModal open={!!assignment} onOpenChange={(o) => !o && onClose()} title={`Submit: ${assignment?.title ?? ""}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!content && !file) return toast.error("Add an answer or attach a file"); submit.mutate(); }}>
        <div className="space-y-1.5">
          <Label htmlFor="sub-content">Your answer</Label>
          <Textarea id="sub-content" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-file">Attachment (optional)</Label>
          <Input id="sub-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={submit.isPending}><Send className="size-4" aria-hidden /> {submit.isPending ? "Submitting…" : "Submit"}</Button>
      </form>
    </FormModal>
  );
}

export function AssignmentsPage() {
  const can = useCan();
  const canManage = can("assignments.manage");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AssignmentRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<AssignmentRow | null>(null);
  const [viewing, setViewing] = useState<AssignmentRow | null>(null);
  const [submitting, setSubmitting] = useState<AssignmentRow | null>(null);

  const query = useQuery({ queryKey: ["assignments", page], queryFn: () => assignmentService.list({ page, pageSize: 10 }) });
  const save = useMutation({
    mutationFn: async ({ input, file }: { input: AssignmentInput; file: File | null }) => {
      const fileId = file ? (await fileService.upload(file)).id : undefined;
      return editing && editing !== "new"
        ? assignmentService.update(editing.id, { title: input.title, description: input.description, dueDate: input.dueDate ?? null, ...(fileId ? { fileId } : {}) })
        : assignmentService.create({ ...input, ...(fileId ? { fileId } : {}) });
    },
    onSuccess: (_r, v) => {
      toast.success(editing === "new" && v.input.notify !== false ? "Assignment sent. Students were notified by email and in the platform." : "Assignment saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => assignmentService.remove(id),
    onSuccess: () => { toast.success("Assignment deleted"); setDeleting(null); qc.invalidateQueries({ queryKey: ["assignments"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={canManage ? "Create assignments and review submissions." : "Your pending and past assignments."}
        actions={canManage && <Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> New assignment</Button>}
      />
      <QueryBoundary loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} empty={items.length === 0} emptyTitle="No assignments" emptyDescription="Assignments will appear here.">
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((a) => (
            <li key={a.id}>
              <Card className="h-full rounded-2xl shadow-sm">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-medium">{a.title}</h2>
                      <p className="text-xs text-muted-foreground">{[a.subject?.name, a.class?.name].filter(Boolean).join(" · ")}</p>
                    </div>
                    {canManage && (
                      <div className="flex">
                        <Button size="icon" variant="ghost" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Delete ${a.title}`} onClick={() => setDeleting(a)}><Trash2 className="size-4" /></Button>
                      </div>
                    )}
                  </div>
                  {a.description && <p className="line-clamp-3 text-sm">{a.description}</p>}
                  {!canManage && a.teacher && <p className="text-xs text-muted-foreground">Posted by {a.teacher.user.firstName} {a.teacher.user.lastName}</p>}
                  {a.fileId && (
                    <Button variant="link" size="sm" className="h-auto w-fit p-0" onClick={() => fileService.open(a.fileId!).catch((e) => toast.error(toApiError(e).message))}>
                      <Paperclip className="size-3.5" aria-hidden /> Download attachment
                    </Button>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="size-4" aria-hidden /> Due {formatDate(a.dueDate)}</span>
                    {canManage ? (
                      <Button size="sm" variant="outline" onClick={() => setViewing(a)}><Eye className="size-4" aria-hidden /> Submissions ({a._count?.submissions ?? 0})</Button>
                    ) : (
                      <Button size="sm" onClick={() => setSubmitting(a)}><Send className="size-4" aria-hidden /> Submit</Button>
                    )}
                  </div>
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

      <FormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New assignment" : "Edit assignment"}>
        {editing && <AssignmentForm initial={editing === "new" ? undefined : editing} submitting={save.isPending} onSubmit={(v, file) => save.mutate({ input: v, file })} />}
      </FormModal>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this assignment?" description="Submissions will be removed too." confirmLabel="Delete" onConfirm={() => deleting && remove.mutate(deleting.id)} />
      <SubmissionsDialog assignment={viewing} onClose={() => setViewing(null)} />
      <SubmitDialog assignment={submitting} onClose={() => setSubmitting(null)} />
    </div>
  );
}
