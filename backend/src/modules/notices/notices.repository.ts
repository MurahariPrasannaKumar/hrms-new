import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const include = { targets: true } satisfies Prisma.NoticeInclude;

export const noticesRepository = {
  list: (where: Prisma.NoticeWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.notice.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include }),
      prisma.notice.count({ where }),
    ]),
  find: (id: string, where: Prisma.NoticeWhereInput = {}) => prisma.notice.findFirst({ where: { id, ...where }, include }),
  create: (data: Prisma.NoticeUncheckedCreateInput) => prisma.notice.create({ data, include }),
  update: (id: string, data: Prisma.NoticeUncheckedUpdateInput, targets?: { roleName?: string | null; classId?: string | null }[]) =>
    prisma.$transaction(async (tx) => {
      if (targets) {
        await tx.noticeTarget.deleteMany({ where: { noticeId: id } });
        await tx.noticeTarget.createMany({ data: targets.map((t) => ({ noticeId: id, roleName: t.roleName, classId: t.classId })) });
      }
      return tx.notice.update({ where: { id }, data, include });
    }),
  remove: (id: string) => prisma.notice.delete({ where: { id } }),
  countClasses: (ids: string[], schoolId: string) => prisma.class.count({ where: { id: { in: ids }, schoolId } }),
};
