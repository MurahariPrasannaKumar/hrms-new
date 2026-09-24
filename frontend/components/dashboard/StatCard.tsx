import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TINT_CLASSES, type Tint } from "@/lib/permissions/nav";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value?: string | number;
  icon?: LucideIcon;
  tint?: Tint;
  hint?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, tint = "indigo", hint, loading }: Props) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight">{value ?? "—"}</p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TINT_CLASSES[tint])}>
            <Icon className="size-5" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}
