import type { AttendanceStatus } from "@/lib/api/people";

export type Level = "good" | "watch" | "risk";

/** >= 90 good, 75-90 watch, < 75 at risk. */
export const levelFor = (pct: number): Level => (pct >= 90 ? "good" : pct >= 75 ? "watch" : "risk");

export const LEVEL_COLOR: Record<Level, string> = { good: "#6f9a6f", watch: "#d9a441", risk: "#c4566b" };
export const LEVEL_LABEL: Record<Level, string> = { good: "On track", watch: "Needs attention", risk: "At risk" };

export const STATUS_COLOR: Record<AttendanceStatus, string> = { PRESENT: "#6f9a6f", ABSENT: "#c4566b", LATE: "#d9a441", EXCUSED: "#6c8fb5" };

/** Attended = PRESENT + LATE. Returns a short, actionable sentence. */
export function attendanceMessage(o: { percentage: number; present: number; late: number; totalDays: number }, target = 75): string {
  if (o.totalDays === 0) return "No attendance recorded yet. Mark today to get started.";
  const attended = o.present + o.late;
  if (o.percentage < target) {
    const days = Math.max(1, Math.ceil(((target / 100) * o.totalDays - attended) / (1 - target / 100)));
    return `${days} more present ${days === 1 ? "day" : "days"} in a row to reach ${target}%.`;
  }
  const spare = Math.floor(attended / (target / 100) - o.totalDays);
  if (o.percentage >= 90) return "Excellent attendance. Keep it up!";
  return spare > 0
    ? `You are above ${target}%. You can miss ${spare} more ${spare === 1 ? "day" : "days"} and stay there — aim for 90%.`
    : `You are right at ${target}%. Every day counts — aim for 90%.`;
}

export const monthLabel = (month: string, style: "short" | "long" = "short") => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: style, ...(style === "long" ? { year: "numeric" } : {}), timeZone: "UTC" });
};
