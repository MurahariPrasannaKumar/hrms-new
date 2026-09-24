import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { notifyPublished } from './notices.service';

/** Sends notifications for scheduled notices whose publish time has arrived. Safe to call concurrently. */
export const publishDueNotices = async (now = new Date()): Promise<number> => {
  const due = await prisma.notice.findMany({
    where: {
      isPublished: true,
      notifiedAt: null,
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { targets: true },
    take: 50,
  });
  let sent = 0;
  for (const notice of due) {
    const claim = await prisma.notice.updateMany({ where: { id: notice.id, notifiedAt: null }, data: { notifiedAt: now } });
    if (claim.count !== 1) continue;
    await notifyPublished(notice);
    sent++;
  }
  return sent;
};

export const startNoticePublisher = (intervalMs = 60_000) => {
  const timer = setInterval(() => {
    publishDueNotices().catch((err) => logger.error({ err }, 'Scheduled notice publisher failed'));
  }, intervalMs);
  timer.unref();
  return timer;
};
