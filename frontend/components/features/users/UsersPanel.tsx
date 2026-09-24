"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, MoreHorizontal, Pencil, Plus, Trash2, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/features/shared/SelectField";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { FilterBar } from "@/components/forms/FilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useListState } from "@/hooks/useListState";
import { adminSchoolApi, adminUserApi, type UserRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";
import { formatDateTime, humanize, personName } from "@/lib/admin-format";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_OPTIONS, STATUS_OPTIONS } from "@/schemas/user";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { UserFormModal } from "./UserFormModal";

interface Props {
  /** Restrict the list (and new users) to one school, e.g. inside the school detail tabs. */
  schoolId?: string;
  showHeader?: boolean;
}

export function UsersPanel({ schoolId, showHeader = true }: Props) {
  const { hasRole } = useAuth();
  const isSuper = hasRole("SUPER_ADMIN");
  const qc = useQueryClient();
  const list = useListState({ by: "createdAt", order: "desc" });
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [deactivating, setDeactivating] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const params = { ...list.params, ...(schoolId ? { schoolId } : {}) };
  const query = useQuery({ queryKey: ["users", params], queryFn: () => adminUserApi.list(params), placeholderData: (p) => p });
  const schools = useQuery({
    queryKey: ["schools", "options"],
    queryFn: () => adminSchoolApi.list({ pageSize: 100, sortBy: "name", sortOrder: "asc" }),
    enabled: isSuper && !schoolId,
  });

  const deactivate = useMutation({
    mutationFn: (u: UserRow) => adminUserApi.remove(u.id),
    onSuccess: () => {
      toast.success("User deactivated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const destroy = useMutation({
    mutationFn: (u: UserRow) => adminUserApi.destroy(u.id),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const assignable = isSuper ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r !== "SUPER_ADMIN");

  const columns: Column<UserRow>[] = [
    {
      key: "name", header: "Name",
      cell: (u) => <span className="font-medium">{personName(u)}<span className="block text-xs font-normal text-muted-foreground">{u.email}</span></span>,
    },
    { key: "role", header: "Role", cell: (u) => humanize(u.role.name) },
    { key: "school", header: "School", cell: (u) => u.school?.name ?? "Platform" },
    { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
    { key: "lastLoginAt", header: "Last login", sortable: true, cell: (u) => formatDateTime(u.lastLoginAt) },
    { key: "createdAt", header: "Created", sortable: true, cell: (u) => formatDateTime(u.createdAt) },
  ];

  return (
    <>
      {showHeader && (
        <PageHeader
          title="Users"
          description="Create accounts, assign roles and schools, and manage access."
          actions={<Button onClick={() => { setEditId(null); setFormOpen(true); }}><Plus className="size-4" /> Add user</Button>}
        />
      )}
      <FilterBar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search by name or email">
        <SelectField aria-label="Filter by role" value={list.filters.role ?? ""} onChange={(e) => list.setFilter("role", e.target.value)}>
          <option value="">All roles</option>
          {assignable.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
        </SelectField>
        <SelectField aria-label="Filter by status" value={list.filters.status ?? ""} onChange={(e) => list.setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </SelectField>
        {isSuper && !schoolId && (
          <SelectField aria-label="Filter by school" value={list.filters.schoolId ?? ""} onChange={(e) => list.setFilter("schoolId", e.target.value)}>
            <option value="">All schools</option>
            {schools.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
        )}
        {!showHeader && <Button onClick={() => { setEditId(null); setFormOpen(true); }}><Plus className="size-4" /> Add user</Button>}
      </FilterBar>
      <DataTable
        columns={columns}
        data={query.data?.items}
        getRowId={(u) => u.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        page={list.page}
        pageSize={list.pageSize}
        total={query.data?.meta.total}
        onPageChange={list.setPage}
        sort={list.sort}
        onSortChange={list.setSort}
        emptyTitle="No users found"
        emptyDescription="Adjust the filters or add a user."
        rowActions={(u) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${personName(u)}`} />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditId(u.id); setFormOpen(true); }}><Pencil className="size-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setResetting(u)}><KeyRound className="size-4" /> Set password</DropdownMenuItem>
              {u.status === "ACTIVE" && <DropdownMenuItem onClick={() => setDeactivating(u)}><UserX className="size-4" /> Deactivate</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => setDeleting(u)} className="text-destructive"><Trash2 className="size-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <UserFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={editId}
        lockedSchoolId={schoolId}
        allowedRoles={assignable}
        canPickSchool={isSuper}
      />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate user?"
        description={deactivating ? `${personName(deactivating)} will be signed out and unable to log in.` : undefined}
        confirmLabel="Deactivate"
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete user permanently?"
        description={deleting ? `${personName(deleting)} (${deleting.email}) will be removed for good. This cannot be undone, but the email can be used for a new user afterwards.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => deleting && destroy.mutate(deleting)}
      />
    </>
  );
}
