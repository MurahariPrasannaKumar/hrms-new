"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FormModal } from "@/components/forms/FormModal";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useListState } from "@/hooks/useListState";
import { toApiError } from "@/lib/api/client";
import { LEAVE_TYPE_LABEL, leaveApi, type LeaveRow, type LeaveType } from "@/lib/api/leave";
import { fmtDate } from "@/lib/format";

const TYPES = Object.entries(LEAVE_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const today = () => new Date().toISOString().slice(0, 10);

/** Count Mon-Fri days between two YYYY-MM-DD dates (mirrors the server). */
const workingDays = (from: string, to: string) => {
  if (!from || !to || to < from) return 0;
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
};

function ApplyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<LeaveType>("CASUAL");
  const [startDate, setStart] = useState(today());
  const [endDate, setEnd] = useState(today());
  const [reason, setReason] = useState("");
  const days = workingDays(startDate, endDate);

  const submit = useMutation({
    mutationFn: () => leaveApi.apply({ type, startDate, endDate, reason }),
    onSuccess: (r) => {
      toast.success(r.adminsNotified ? "Leave request sent to your administrator" : "Leave request submitted");
      qc.invalidateQueries({ queryKey: ["leave"] });
      setReason("");
      onClose();
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  return (
    <FormModal open={open} onOpenChange={(o) => !o && onClose()} title="Apply for leave" description="Your administrator is notified in the platform and by email, and you hear back once they decide.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
        <div className="space-y-1.5">
          <Label htmlFor="lv-type">Leave type</Label>
          <NativeSelect id="lv-type" value={type} onChange={(e) => setType(e.target.value as LeaveType)} options={TYPES} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lv-from">From</Label>
            <Input id="lv-from" type="date" required min={today()} value={startDate} onChange={(e) => { setStart(e.target.value); if (endDate < e.target.value) setEnd(e.target.value); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lv-to">To</Label>
            <Input id="lv-to" type="date" required min={startDate} value={endDate} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {days > 0 ? `${days} working day${days === 1 ? "" : "s"} (weekends are not counted)` : "Pick at least one working day"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="lv-reason">Reason</Label>
          <Textarea id="lv-reason" required minLength={5} maxLength={1000} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submit.isPending || days === 0 || reason.trim().length < 5}>{submit.isPending ? "Sending…" : "Send request"}</Button>
        </div>
      </form>
    </FormModal>
  );
}

export function LeaveEmployeePage() {
  const qc = useQueryClient();
  const list = useListState({ by: "createdAt", order: "desc" });
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRow | null>(null);

  const balances = useQuery({ queryKey: ["leave", "balances"], queryFn: leaveApi.balances });
  const mine = useQuery({ queryKey: ["leave", "mine", list.params], queryFn: () => leaveApi.mine(list.params), placeholderData: (p) => p });
  const cancel = useMutation({
    mutationFn: (l: LeaveRow) => leaveApi.cancel(l.id),
    onSuccess: () => { toast.success("Request cancelled"); setCancelling(null); qc.invalidateQueries({ queryKey: ["leave"] }); },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const columns: Column<LeaveRow>[] = [
    { key: "type", header: "Type", cell: (l) => LEAVE_TYPE_LABEL[l.type] },
    { key: "dates", header: "Dates", cell: (l) => (l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`) },
    { key: "days", header: "Days", cell: (l) => l.days },
    { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
    {
      key: "note", header: "Admin note",
      cell: (l) => (l.reviewNote ? <span className="text-muted-foreground">{l.reviewNote}</span> : l.reviewer ? <span className="text-xs text-muted-foreground">by {l.reviewer.firstName} {l.reviewer.lastName}</span> : "—"),
    },
    { key: "createdAt", header: "Applied", cell: (l) => fmtDate(l.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Leave"
        description="Apply for leave and track your requests."
        actions={<Button onClick={() => setApplying(true)}><Plus className="size-4" /> Apply for leave</Button>}
      />
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Leave balances">
        {(balances.data ?? []).filter((b) => b.allowance != null).map((b) => (
          <div key={b.type} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{LEAVE_TYPE_LABEL[b.type]}</p>
            <p className="mt-1 text-2xl font-semibold">{b.remaining}<span className="text-sm font-normal text-muted-foreground"> / {b.allowance} days left</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{b.used} used{b.pending ? ` · ${b.pending} pending` : ""}</p>
          </div>
        ))}
      </section>
      <DataTable
        columns={columns}
        data={mine.data?.items}
        getRowId={(l) => l.id}
        isLoading={mine.isLoading}
        error={mine.error}
        onRetry={() => mine.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={mine.data?.meta.total}
        onPageChange={list.setPage}
        emptyTitle="No leave requests yet"
        emptyDescription="Use “Apply for leave” to send your first request."
        rowActions={(l) => l.status === "PENDING" && <Button variant="ghost" size="sm" onClick={() => setCancelling(l)}>Cancel</Button>}
      />
      <ApplyDialog open={applying} onClose={() => setApplying(false)} />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this request?"
        description="Your administrator will no longer be able to approve it."
        confirmLabel="Cancel request"
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
      />
    </>
  );
}
