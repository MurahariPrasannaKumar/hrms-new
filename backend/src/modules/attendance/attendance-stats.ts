import { prisma } from '../../config/database';

export type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export interface DayRow { date: Date; status: Status }

/** Attendance percentage = (PRESENT + LATE) / all recorded days. ABSENT and EXCUSED count against it. */
export const isAttended = (s: Status) => s === 'PRESENT' || s === 'LATE';
export const pct = (attended: number, total: number) => (total ? Math.round((attended / total) * 1000) / 10 : 0);

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Local calendar date (YYYY-MM-DD) in an IANA timezone; falls back to UTC for invalid zones. */
export const localDateString = (timeZone: string, at = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
};
export const localTimeString = (timeZone: string, at: Date): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  } catch {
    return at.toISOString().slice(11, 16);
  }
};

export const schoolTimezone = async (schoolId: string): Promise<string> =>
  (await prisma.schoolSetting.findUnique({ where: { schoolId }, select: { timezone: true } }))?.timezone ?? 'UTC';

/** Mon-Fri days from `from` to `to` inclusive (YYYY-MM-DD strings). */
export const weekdaysBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = toDate(from); d <= toDate(to); d = new Date(d.getTime() + 86_400_000)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(ymd(d));
  }
  return out;
};

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  return ymd(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7);
};

export interface Overview {
  overall: { percentage: number; present: number; absent: number; late: number; excused: number; totalDays: number };
  month: { month: string; percentage: number; totalDays: number; days: { date: string; status: Status }[] };
  trend: { month: string; percentage: number | null; totalDays: number }[];
  streak: { current: number; longest: number };
}

export const buildOverview = (rows: DayRow[], month: string, todayStr: string): Overview => {
  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const r of sorted) counts[r.status]++;
  const total = sorted.length;

  const inMonth = (m: string) => sorted.filter((r) => ymd(r.date).startsWith(m));
  const monthRows = inMonth(month);

  const thisMonth = todayStr.slice(0, 7);
  const trend = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5)).map((m) => {
    const rs = inMonth(m);
    return { month: m, percentage: rs.length ? pct(rs.filter((r) => isAttended(r.status)).length, rs.length) : null, totalDays: rs.length };
  });

  let longest = 0;
  let run = 0;
  for (const r of sorted) {
    run = isAttended(r.status) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let i = sorted.length - 1; i >= 0 && isAttended(sorted[i].status); i--) current++;

  return {
    overall: {
      percentage: pct(counts.PRESENT + counts.LATE, total),
      present: counts.PRESENT, absent: counts.ABSENT, late: counts.LATE, excused: counts.EXCUSED, totalDays: total,
    },
    month: {
      month,
      percentage: pct(monthRows.filter((r) => isAttended(r.status)).length, monthRows.length),
      totalDays: monthRows.length,
      days: monthRows.map((r) => ({ date: ymd(r.date), status: r.status })),
    },
    trend,
    streak: { current, longest },
  };
};
