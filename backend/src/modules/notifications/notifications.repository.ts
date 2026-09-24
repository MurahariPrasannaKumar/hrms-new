import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const notificationsRepository = {
  list: (where: Prisma.NotificationWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]),
  unreadCount: (userId: string) => prisma.notification.count({ where: { userId, read: false } }),
  markRead: (id: string, userId: string) =>
    prisma.notification.updateMany({ where: { id, userId }, data: { read: true } }),
  markAllRead: (userId: string) =>
    prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } }),
  findOwn: (id: string, userId: string) => prisma.notification.findFirst({ where: { id, userId } }),
};
