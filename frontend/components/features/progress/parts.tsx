import { Badge } from "@/components/ui/badge";
import type { Risk } from "@/lib/api/attendance-progress";
import { cn } from "@/lib/utils";
import { LEVEL_COLOR, levelFor } from "../attendance/attendance-utils";

const RISK: Record<Risk, { label: string; className: string }> = {
  ok: { label: "On track", className: "bg-emerald-50 text-emerald-800" },
  watch: { label: "Watch", className: "bg-amber-50 text-amber-800" },
  at_risk: { label: "At risk", className: "bg-rose-50 text-rose-800" },
};

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <Badge variant="secondary" className={cn("rounded-full font-medium", RISK[risk].className)} data-risk={risk}>
      {RISK[risk].label}
    </Badge>
  );
}

/** Exam averages are judged against the risk thresholds (<40 at risk, <55 watch). */
const examColor = (pct: number) => (pct < 40 ? LEVEL_COLOR.risk : pct < 55 ? LEVEL_COLOR.watch : LEVEL_COLOR.good);

export function PctCell({ value, kind = "attendance" }: { value: number | null; kind?: "attendance" | "exam" }) {
  if (value === null) return <span className="text-muted-foreground" aria-label="No data">—</span>;
  const color = kind === "attendance" ? LEVEL_COLOR[levelFor(value)] : examColor(value);
  return (
    <div className="flex min-w-24 items-center gap-2">
      <span className="w-12 text-sm tabular-nums">{value}%</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </span>
    </div>
  );
}

export const fmtWhen = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never";
