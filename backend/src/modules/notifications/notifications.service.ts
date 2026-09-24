import type { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';
import { notificationsRepository as repo } from './notifications.repository';

export const notificationsService = {
  async list(userId: string, q: PaginationQuery & { unread?: string; type?: Prisma.NotificationWhereInput['type'] }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(q.unread === 'true' ? { read: false } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.search ? { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { message: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const { skip, take } = pageArgs(q);
    const [[items, total], unread] = await Promise.all([repo.list(where, skip, take), repo.unreadCount(userId)]);
    return { items, meta: { ...pageMeta(q, total), unreadCount: unread } };
  },

  async markRead(id: string, userId: string) {
    const res = await repo.markRead(id, userId);
    if (!res.count) throw ApiError.notFound('Notification not found');
    return repo.findOwn(id, userId);
  },

  async markAllRead(userId: string) {
    return { updated: (await repo.markAllRead(userId)).count };
  },
};
