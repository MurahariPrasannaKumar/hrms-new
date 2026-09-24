"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { adminSchoolApi, modulesApi, type ModuleRow } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/client";

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${checked ? "bg-primary" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Platform switches (row) x per-school availability (columns). */
export function ModulesMatrix() {
  const qc = useQueryClient();
  const schools = useQuery({
    queryKey: ["schools", "options"],
    queryFn: () => adminSchoolApi.list({ pageSize: 100, sortBy: "name", sortOrder: "asc" }),
  });
  const platform = useQuery({ queryKey: ["modules", "platform"], queryFn: () => modulesApi.list() });
  const perSchool = useQueries({
    queries: (schools.data?.items ?? []).map((s) => ({
      queryKey: ["modules", "school", s.id],
      queryFn: () => modulesApi.list(s.id),
    })),
  });

  const setPlatform = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => modulesApi.setPlatform(v.key, v.enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules"] }),
    onError: (e) => toast.error(toApiError(e).message),
  });
  const setSchool = useMutation({
    mutationFn: (v: { schoolId: string; key: string; enabled: boolean }) => modulesApi.setSchool(v.schoolId, v.key, v.enabled),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["modules", "school", v.schoolId] }),
    onError: (e) => toast.error(toApiError(e).message),
  });

  if (platform.error || schools.error) return <ErrorState error={platform.error ?? schools.error} onRetry={() => { platform.refetch(); schools.refetch(); }} />;
  if (platform.isLoading || schools.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  const mods: ModuleRow[] = platform.data ?? [];
  if (!mods.length) return <EmptyState title="No modules" description="Seed the database to register modules." />;
  const schoolList = schools.data?.items ?? [];

  const schoolState = (schoolIdx: number, key: string) => perSchool[schoolIdx]?.data?.find((m) => m.key === key)?.schoolEnabled ?? true;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <caption className="sr-only">Module availability by school</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-4 py-3 font-medium">Module</th>
            <th scope="col" className="px-4 py-3 font-medium">Platform</th>
            {schoolList.map((s) => <th key={s.id} scope="col" className="px-4 py-3 font-medium">{s.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => (
            <tr key={m.key} className="border-b last:border-0">
              <th scope="row" className="px-4 py-3 text-left font-medium">{m.name}</th>
              <td className="px-4 py-3">
                <Toggle label={`${m.name} platform-wide`} checked={m.enabled} onChange={(enabled) => setPlatform.mutate({ key: m.key, enabled })} />
              </td>
              {schoolList.map((s, i) => (
                <td key={s.id} className="px-4 py-3">
                  <Toggle
                    label={`${m.name} for ${s.name}`}
                    checked={schoolState(i, m.key)}
                    disabled={!m.enabled}
                    onChange={(enabled) => setSchool.mutate({ schoolId: s.id, key: m.key, enabled })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
