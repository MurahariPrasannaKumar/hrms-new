import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PRESENT: "bg-emerald-50 text-emerald-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  INACTIVE: "bg-slate-100 text-slate-700",
  ABSENT: "bg-rose-50 text-rose-700",
  SUSPENDED: "bg-rose-50 text-rose-700",
  EMERGENCY: "bg-rose-50 text-rose-700",
  LATE: "bg-amber-50 text-amber-700",
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-700",
  EXCUSED: "bg-sky-50 text-sky-700",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  return (
    <Badge variant="secondary" className={cn("rounded-full font-medium capitalize", STYLES[status.toUpperCase()] ?? "bg-orange-50 text-orange-700", className)}>
      {label}
    </Badge>
  );
}
