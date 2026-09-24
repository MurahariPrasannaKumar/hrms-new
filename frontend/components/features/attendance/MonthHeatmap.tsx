import type { AttendanceStatus } from "@/lib/api/people";
import { cn } from "@/lib/utils";
import { STATUS_COLOR } from "./attendance-utils";

interface Props {
  month: string; // YYYY-MM
  days: { date: string; status: AttendanceStatus }[];
  today?: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Calendar grid (Mon-first); each recorded day is tinted by its status. */
export function MonthHeatmap({ month, days, today }: Props) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const byDate = new Map(days.map((d) => [d.date, d.status]));
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5" role="grid" aria-label="Attendance calendar">
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const key = `${month}-${String(day).padStart(2, "0")}`;
          const status = byDate.get(key);
          return (
            <div
              key={key}
              role="gridcell"
              aria-label={`${day} ${first.toLocaleDateString(undefined, { month: "long", timeZone: "UTC" })}: ${status ? status.toLowerCase() : "no record"}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-xs font-medium",
                status ? "text-white" : "bg-muted text-muted-foreground",
                key === today && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
              style={status ? { backgroundColor: STATUS_COLOR[status] } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {(Object.keys(STATUS_COLOR) as AttendanceStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLOR[s] }} aria-hidden />
            <span className="capitalize">{s.toLowerCase()}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted" aria-hidden />No record</li>
      </ul>
    </div>
  );
}
