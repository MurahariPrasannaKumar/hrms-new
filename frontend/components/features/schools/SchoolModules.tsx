"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { modulesApi, type ModuleRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";

interface Props {
  schoolId: string;
  modules?: ModuleRow[];
  loading?: boolean;
  error?: unknown;
}

/** Per-school module availability (settings tab). Platform-disabled modules cannot be enabled here. */
export function SchoolModules({ schoolId, modules, loading, error }: Props) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => modulesApi.setSchool(schoolId, v.key, v.enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules", "school", schoolId] }),
    onError: (e) => toast.error(toApiError(e).message),
  });

  if (error) return <ErrorState error={error} />;
  if (loading || !modules) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <section aria-labelledby="school-modules-title" className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 id="school-modules-title" className="mb-1 text-base font-semibold">Module availability</h2>
      <p className="mb-4 text-sm text-muted-foreground">Choose which modules this school can use.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => {
          const on = m.enabled && (m.schoolEnabled ?? true);
          return (
            <li key={m.key} className="flex items-center justify-between rounded-xl border px-3 py-2">
              <label htmlFor={`mod-${m.key}`} className="text-sm font-medium">
                {m.name}
                {!m.enabled && <span className="ml-2 text-xs font-normal text-muted-foreground">(disabled platform-wide)</span>}
              </label>
              <input
                id={`mod-${m.key}`}
                type="checkbox"
                role="switch"
                className="size-4 accent-primary"
                checked={on}
                disabled={!m.enabled || toggle.isPending}
                onChange={(e) => toggle.mutate({ key: m.key, enabled: e.target.checked })}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
