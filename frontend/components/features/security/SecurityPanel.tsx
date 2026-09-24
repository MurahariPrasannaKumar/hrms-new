"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogTable } from "@/components/features/audit/AuditLogTable";
import { securityApi, type LoginAttemptRow, type SessionRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { formatDateTime, personName } from "@/lib/admin-format";
import { useAuth } from "@/lib/auth/AuthProvider";

function LoginTable({ failedOnly }: { failedOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const params = { page, pageSize: 10 };
  const query = useQuery({
    queryKey: ["security", failedOnly ? "failed" : "logins", params],
    queryFn: () => (failedOnly ? securityApi.failedLogins(params) : securityApi.loginActivity(params)),
    placeholderData: (p) => p,
  });
  const columns: Column<LoginAttemptRow>[] = [
    { key: "createdAt", header: "When", cell: (a) => formatDateTime(a.createdAt) },
    { key: "email", header: "Account" },
    { key: "success", header: "Result", cell: (a) => <StatusBadge status={a.success ? "ACTIVE" : "SUSPENDED"} className="" /> },
    { key: "ipAddress", header: "IP", cell: (a) => a.ipAddress ?? "—" },
    { key: "userAgent", header: "Device", cell: (a) => <span className="block max-w-56 truncate">{a.userAgent ?? "—"}</span> },
  ];
  return (
    <DataTable
      columns={columns}
      data={query.data?.items}
      getRowId={(a) => a.id}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      page={page}
      pageSize={10}
      total={query.data?.meta.total}
      onPageChange={setPage}
      emptyTitle={failedOnly ? "No failed sign-ins" : "No login activity"}
    />
  );
}

function SessionsTable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState<SessionRow | null>(null);
  const params = { page, pageSize: 10 };
  const query = useQuery({ queryKey: ["security", "sessions", params], queryFn: () => securityApi.sessions(params), placeholderData: (p) => p });
  const revoke = useMutation({
    mutationFn: (s: SessionRow) => securityApi.revokeSession(s.id),
    onSuccess: () => {
      toast.success("Session revoked");
      qc.invalidateQueries({ queryKey: ["security", "sessions"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });
  const columns: Column<SessionRow>[] = [
    { key: "user", header: "User", cell: (s) => <span>{personName(s.user)}<span className="block text-xs text-muted-foreground">{s.user.email}</span></span> },
    { key: "ipAddress", header: "IP", cell: (s) => s.ipAddress ?? "—" },
    { key: "userAgent", header: "Device", cell: (s) => <span className="block max-w-56 truncate">{s.userAgent ?? "—"}</span> },
    { key: "createdAt", header: "Started", cell: (s) => formatDateTime(s.createdAt) },
    { key: "lastSeenAt", header: "Last active", cell: (s) => formatDateTime(s.lastSeenAt) },
  ];
  return (
    <>
      <DataTable
        columns={columns}
        data={query.data?.items}
        getRowId={(s) => s.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        page={page}
        pageSize={10}
        total={query.data?.meta.total}
        onPageChange={setPage}
        emptyTitle="No active sessions"
        rowActions={(s) =>
          s.user.id === user?.id ? null : (
            <Button variant="ghost" size="sm" onClick={() => setRevoking(s)} aria-label={`Revoke session for ${s.user.email}`}>
              <Ban className="size-4" /> Revoke
            </Button>
          )
        }
      />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke session?"
        description="The user will be signed out on that device."
        confirmLabel="Revoke"
        onConfirm={() => revoking && revoke.mutate(revoking)}
      />
    </>
  );
}

/** Login activity, failed sign-ins, active sessions and audit trail; server scopes results to the caller's school. */
export function SecurityPanel() {
  return (
    <Tabs defaultValue="activity">
      <TabsList>
        <TabsTrigger value="activity">Login activity</TabsTrigger>
        <TabsTrigger value="failed">Failed logins</TabsTrigger>
        <TabsTrigger value="sessions">Active sessions</TabsTrigger>
        <TabsTrigger value="audit">Audit trail</TabsTrigger>
      </TabsList>
      <TabsContent value="activity"><LoginTable /></TabsContent>
      <TabsContent value="failed"><LoginTable failedOnly /></TabsContent>
      <TabsContent value="sessions"><SessionsTable /></TabsContent>
      <TabsContent value="audit"><AuditLogTable /></TabsContent>
    </Tabs>
  );
}
