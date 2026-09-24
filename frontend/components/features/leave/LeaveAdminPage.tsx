"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/features/shared/SelectField";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { FilterBar } from "@/components/forms/FilterBar";
import { FormModal } from "@/components/forms/FormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useListState } from "@/hooks/useListState";
import { toApiError } from "@/lib/api/client";
import { LEAVE_TYPE_LABEL, leaveApi, type LeaveRow } from "@/lib/api/leave";
import { humanize } from "@/lib/admin-format";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

type Decision = "APPROVED" | "REJECTED" | "CANCELLED";

function ReviewDialog({ target, onClose }: { target: { leave: LeaveRow; decision: Decision } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const approving = target?.decision === "APPROVED";
  const save = useMutation({
    mutationFn: () => leaveApi.review(target!.leave.id, { decision: target!.decision, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success(`Leave ${approving ? "approved" : target?.decision === "CANCELLED" ? "cancelled" : "rejected"}. The employee has been notified by email.`);
      qc.invalidateQueries({ queryKey: ["leave"] });
      setNote("");
      onClose();
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const l = target?.leave;
  return (
    <FormModal
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={approving ? "Approve leave" : target?.decision === "CANCELLED" ? "Cancel leave" : "Reject leave"}
      description={l ? `${l.user.firstName} ${l.user.lastName} · ${LEAVE_TYPE_LABEL[l.type]} · ${l.days} day${l.days === 1 ? "" : "s"}` : undefined}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {l && <p className="rounded-xl bg-muted/60 p-3 text-sm"><span className="font-medium">Reason: </span>{l.reason}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="rv-note">Note to employee {approving ? "(optional)" : "(recommended)"}</Label>
          <Textarea id="rv-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={approving ? "default" : "destructive"} disabled={save.isPending}>
            {save.isPending ? "Saving…" : approving ? "Approve" : target?.decision === "CANCELLED" ? "Cancel leave" : "Reject"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function LeaveAdminPage() {
  const { hasRole } = useAuth();
  const isSuper = hasRole("SUPER_ADMIN");
  const list = useListState({ by: "createdAt", order: "desc" });
  const [target, setTarget] = useState<{ leave: LeaveRow; decision: Decision } | null>(null);
  const params = { ...list.params, status: list.filters.status ?? "PENDING" };
  const query = useQuery({ queryKey: ["leave", "admin", params, list.filters.type], queryFn: () => leaveApi.list({ ...params, ...(list.filters.type ? { type: list.filters.type } : {}) }), placeholderData: (p) => p });
  const pendingCount = (query.data?.meta as { pendingCount?: number } | undefined)?.pendingCount ?? 0;

  const columns: Column<LeaveRow>[] = [
    {
      key: "employee", header: "Employee",
      cell: (l) => <span className="font-medium">{l.user.firstName} {l.user.lastName}<span className="block text-xs font-normal text-muted-foreground">{humanize(l.user.role.name)} · {l.user.email}</span></span>,
    },
    ...(isSuper ? [{ key: "school", header: "School", cell: (l: LeaveRow) => l.school?.name ?? "—" }] : []),
    { key: "type", header: "Type", cell: (l) => LEAVE_TYPE_LABEL[l.type] },
    { key: "dates", header: "Dates", cell: (l) => <span>{l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`}<span className="block text-xs text-muted-foreground">{l.days} working day{l.days === 1 ? "" : "s"}</span></span> },
    { key: "reason", header: "Reason", cell: (l) => <span className="line-clamp-2 max-w-xs text-muted-foreground" title={l.reason}>{l.reason}</span> },
    { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
    { key: "createdAt", header: "Applied", cell: (l) => fmtDate(l.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Leave requests" description={pendingCount ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting for your decision.` : "Review leave requests from teachers and staff."} />
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search by employee name or email">
        <SelectField aria-label="Filter by status" value={list.filters.status ?? "PENDING"} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="">All statuses</option>
        </SelectField>
        <SelectField aria-label="Filter by type" value={list.filters.type ?? ""} onChange={(e) => list.setFilter("type", e.target.value)}>
          <option value="">All types</option>
          {Object.entries(LEAVE_TYPE_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </SelectField>
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
        emptyTitle="No leave requests"
        emptyDescription="Requests from your teachers and staff will appear here."
        rowActions={(l) => l.status === "APPROVED" ? (
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" aria-label={`Cancel approved leave for ${l.user.firstName}`} onClick={() => setTarget({ leave: l, decision: "CANCELLED" })}><X className="size-4" /> Cancel leave</Button>
          </div>
        ) : l.status === "PENDING" && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" aria-label={`Approve leave for ${l.user.firstName}`} onClick={() => setTarget({ leave: l, decision: "APPROVED" })}><Check className="size-4" /> Approve</Button>
            <Button size="sm" variant="ghost" aria-label={`Reject leave for ${l.user.firstName}`} onClick={() => setTarget({ leave: l, decision: "REJECTED" })}><X className="size-4" /> Reject</Button>
          </div>
        )}
      />
      <ReviewDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}
