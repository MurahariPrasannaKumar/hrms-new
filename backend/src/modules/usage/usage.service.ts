import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { toUtcDate } from '../../utils/actor';
import { localDateString, schoolTimezone } from '../attendance/attendance-stats';

/** A single heartbeat can credit at most this many seconds. */
export const MAX_BEAT_SECONDS = 60;

const todayFor = async (schoolId: string | null) => {
  const tz = schoolId ? await schoolTimezone(schoolId) : 'UTC';
  return toUtcDate(localDateString(tz));
};

export const usageService = {
  /** Total active seconds for a user on the school's current day. */
  async today(userId: string, schoolId: string | null) {
    const date = await todayFor(schoolId);
    const row = await prisma.usageDay.findUnique({ where: { userId_date: { userId, date } } });
    return { date: date.toISOString().slice(0, 10), seconds: row?.seconds ?? 0 };
  },

  /**
   * The browser reports how many seconds the user was actively using the app since its last beat.
   * The server never credits more than the real time elapsed since the previous beat, so a client
   * cannot inflate its total by sending large numbers.
   */
  async heartbeat(actor: AuthUser, reported: number) {
    const date = await todayFor(actor.schoolId);
    const now = new Date();
    const claimed = Math.max(0, Math.min(Math.floor(reported), MAX_BEAT_SECONDS));
    const row = await prisma.usageDay.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (!row) {
      const created = await prisma.usageDay.create({ data: { userId: actor.id, date, seconds: Math.min(claimed, 20), lastBeatAt: now } });
      return { date: date.toISOString().slice(0, 10), seconds: created.seconds };
    }
    const elapsed = Math.max(0, Math.floor((now.getTime() - row.lastBeatAt.getTime()) / 1000));
    const credit = Math.min(claimed, elapsed + 2);
    const updated = await prisma.usageDay.update({ where: { id: row.id }, data: { seconds: { increment: credit }, lastBeatAt: now } });
    return { date: date.toISOString().slice(0, 10), seconds: updated.seconds };
  },
};
