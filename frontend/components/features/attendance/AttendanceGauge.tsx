import { cn } from "@/lib/utils";
import { LEVEL_COLOR, levelFor } from "./attendance-utils";

interface Props {
  percentage: number;
  size?: number;
  label?: string;
  className?: string;
}

/** Ring gauge coloured by threshold (>=90 good, 75-90 watch, <75 at risk). */
export function AttendanceGauge({ percentage, size = 132, label = "Attendance", className }: Props) {
  const stroke = Math.max(8, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, percentage));
  const color = LEVEL_COLOR[levelFor(pct)];
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${pct}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-semibold tracking-tight" style={{ fontSize: size * 0.24 }}>{pct}%</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
