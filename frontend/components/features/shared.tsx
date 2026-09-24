"use client";

import { PlugZap } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { toApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export const isModuleDisabled = (err: unknown) => !!err && toApiError(err).code === "MODULE_DISABLED";

export function ModuleDisabled({ name }: { name?: string }) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <EmptyState
        title="This module is not enabled for your school"
        description={`${name ? `${name} has` : "It has"} been switched off by your administrator. Contact your school admin if you need access.`}
        action={<PlugZap className="size-5 text-muted-foreground" aria-hidden />}
      />
    </div>
  );
}

interface BoundaryProps {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  moduleName?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}

/** Loading / module-disabled / error / empty / success switch used by every feature list. */
export function QueryBoundary({ loading, error, onRetry, moduleName, empty, emptyTitle = "Nothing here yet", emptyDescription, emptyAction, children }: BoundaryProps) {
  if (loading) return <LoadingSkeleton rows={4} />;
  if (isModuleDisabled(error)) return <ModuleDisabled name={moduleName} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (empty) return <div className="rounded-2xl border bg-card shadow-sm"><EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} /></div>;
  return <>{children}</>;
}

export function useCan() {
  const { user } = useAuth();
  return (perm: string) => !!user?.permissions.includes(perm);
}

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

/** <input type="date"> value (yyyy-mm-dd) → ISO string, or undefined when empty. */
export const dateInputToIso = (v?: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : undefined);
export const isoToDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
export const isoToDateTimeInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
