import type { Request } from 'express';
import type { NoticeType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { optionalSchoolScope, resolveSchoolId } from '../../middlewares/tenant';
import { ApiError } from '../../utils/ApiError';
import { getMemberScope } from '../../utils/actor';
import { audit } from '../../utils/audit';
import { pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';
import { notificationService } from '../notifications/notification.service';
import { noticesRepository as repo } from './notices.repository';

type Target = { roleName?: string | null; classId?: string | null };

const isManager = (req: Request) => req.user!.permissions.includes('notices.create');

const liveWhere = (now: Date): Prisma.NoticeWhereInput => ({
  isPublished: true,
  AND: [
    { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  ],
});

/** Non-managers only see live notices addressed to their role/class (or to everyone). */
const audienceWhere = async (req: Request): Promise<Prisma.NoticeWhereInput> => {
  const scope = await getMemberScope(req.user!);
  const classIds = scope?.classIds ?? [];
  return {
    OR: [
      { targets: { none: {} } },
      {
        targets: {
          some: {
            AND: [
              { OR: [{ roleName: null }, { roleName: req.user!.role }] },
              { OR: [{ classId: null }, { classId: { in: classIds } }] },
            ],
          },
        },
      },
    ],
  };
};

export const buildNoticeVisibility = async (req: Request, schoolId?: string): Promise<Prisma.NoticeWhereInput> => {
  const base: Prisma.NoticeWhereInput = schoolId ? { schoolId } : {};
  if (isManager(req)) return base;
  return { AND: [base, liveWhere(new Date()), await audienceWhere(req)] };
};

const validateTargets = async (targets: Target[], schoolId: string) => {
  const classIds = [...new Set(targets.map((t) => t.classId).filter((x): x is string => !!x))];
  if (classIds.length && (await repo.countClasses(classIds, schoolId)) !== classIds.length) {
    throw ApiError.badRequest('One or more target classes do not belong to this school');
  }
};

const recipientsFor = async (schoolId: string, authorId: string, targets: Target[]): Promise<string[]> => {
  const users = new Set<string>();
  if (!targets.length) {
    (await prisma.user.findMany({ where: { schoolId, status: 'ACTIVE' }, select: { id: true } })).forEach((u) => users.add(u.id));
  }
  for (const t of targets) {
    if (t.roleName && !t.classId) {
      (await prisma.user.findMany({ where: { schoolId, status: 'ACTIVE', role: { name: t.roleName } }, select: { id: true } })).forEach((u) => users.add(u.id));
    } else if (t.classId) {
      const role = t.roleName;
      if (!role || role === 'STUDENT' || role === 'PARENT') {
        const students = await prisma.student.findMany({ where: { schoolId, classId: t.classId }, select: { userId: true, parent: { select: { userId: true } } } });
        students.forEach((s) => {
          if (!role || role === 'STUDENT') s.userId && users.add(s.userId);
          if (!role || role === 'PARENT') s.parent?.userId && users.add(s.parent.userId);
        });
      }
      if (!role || role === 'TEACHER') {
        (await prisma.teacherClass.findMany({ where: { classId: t.classId }, select: { teacher: { select: { userId: true } } } })).forEach((x) => users.add(x.teacher.userId));
      }
    }
  }
  users.delete(authorId);
  return [...users];
};

export const notifyPublished = async (notice: { id: string; title: string; body: string; type: NoticeType; schoolId: string; authorId: string; targets: Target[] }) => {
  const ids = await recipientsFor(notice.schoolId, notice.authorId, notice.targets);
  const [school, author] = await Promise.all([
    prisma.school.findUnique({ where: { id: notice.schoolId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: notice.authorId }, select: { firstName: true, lastName: true } }),
  ]);
  const type = notice.type[0] + notice.type.slice(1).toLowerCase();
  // Everyone the notice is addressed to gets a platform notification and an email.
  await notificationService.notify(
    ids,
    {
      type: 'NOTICE', link: '/notices', title: notice.title,
      message: notice.body.length > 600 ? `${notice.body.slice(0, 600)}...` : notice.body,
      email: {
        category: `${type} notice`,
        details: [
          { label: 'Type', value: type },
          ...(school ? [{ label: 'School', value: school.name }] : []),
          ...(author ? [{ label: 'Posted by', value: `${author.firstName} ${author.lastName}` }] : []),
        ],
        action: { label: 'Open noticeboard', path: '{area}/notices' },
      },
    },
    ['IN_APP', 'EMAIL'],
  );
  await prisma.notice.update({ where: { id: notice.id }, data: { notifiedAt: new Date() } });
};

/** Emailing a whole school takes a while; the admin's request should not wait for it. */
const deliverInBackground = (notice: Parameters<typeof notifyPublished>[0]) => {
  void notifyPublished(notice).catch((err) => logger.error({ err, noticeId: notice.id }, 'Notice delivery failed'));
};

const statusWhere = (status: string, now: Date): Prisma.NoticeWhereInput => {
  switch (status) {
    case 'draft': return { isPublished: false };
    case 'scheduled': return { isPublished: true, publishAt: { gt: now } };
    case 'expired': return { expiresAt: { lte: now } };
    default: return liveWhere(now);
  }
};

export const noticesService = {
  async list(req: Request, q: PaginationQuery & { schoolId?: string; type?: NoticeType; status?: string }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const and: Prisma.NoticeWhereInput[] = [await buildNoticeVisibility(req, schoolId)];
    if (q.type) and.push({ type: q.type });
    if (q.search) and.push({ OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }] });
    if (q.status && isManager(req)) and.push(statusWhere(q.status, new Date()));
    const { skip, take } = pageArgs(q);
    const [items, total] = await repo.list({ AND: and }, skip, take);
    return { items, meta: pageMeta(q, total) };
  },

  async get(req: Request, id: string) {
    const schoolId = optionalSchoolScope(req);
    const notice = await repo.find(id, await buildNoticeVisibility(req, schoolId));
    if (!notice) throw ApiError.notFound('Notice not found');
    return notice;
  },

  async create(req: Request, body: { schoolId?: string; title: string; body: string; type: NoticeType; publish: boolean; publishAt?: Date; expiresAt?: Date; targets: Target[] }) {
    const schoolId = resolveSchoolId(req, body.schoolId);
    if (body.expiresAt && body.publishAt && body.expiresAt <= body.publishAt) throw ApiError.badRequest('expiresAt must be after publishAt');
    await validateTargets(body.targets, schoolId);
    const notice = await repo.create({
      schoolId, authorId: req.user!.id, title: body.title, body: body.body, type: body.type,
      isPublished: body.publish, publishAt: body.publish ? (body.publishAt ?? new Date()) : body.publishAt, expiresAt: body.expiresAt,
      targets: { create: body.targets.map((t) => ({ roleName: t.roleName, classId: t.classId })) },
    });
    if (notice.isPublished && (!notice.publishAt || notice.publishAt <= new Date())) deliverInBackground(notice);
    await audit(req, { schoolId, action: notice.isPublished ? 'PUBLISH' : 'CREATE', resource: 'NOTICE', resourceId: notice.id });
    return notice;
  },

  async update(req: Request, id: string, body: { title?: string; body?: string; type?: NoticeType; publish?: boolean; publishAt?: Date | null; expiresAt?: Date | null; targets?: Target[] }) {
    const existing = await repo.find(id, req.user!.role === 'SUPER_ADMIN' ? {} : { schoolId: req.user!.schoolId! });
    if (!existing) throw ApiError.notFound('Notice not found');
    if (body.targets) await validateTargets(body.targets, existing.schoolId);

    const data: Prisma.NoticeUncheckedUpdateInput = { title: body.title, body: body.body, type: body.type, expiresAt: body.expiresAt };
    if (body.publishAt !== undefined) data.publishAt = body.publishAt;
    if (body.publish !== undefined) {
      data.isPublished = body.publish;
      if (body.publish && body.publishAt === undefined && !existing.publishAt) data.publishAt = new Date();
    }
    const notice = await repo.update(id, data, body.targets);
    const justPublished = !existing.isPublished && notice.isPublished && (!notice.publishAt || notice.publishAt <= new Date());
    if (justPublished) deliverInBackground(notice);
    await audit(req, { schoolId: existing.schoolId, action: justPublished ? 'PUBLISH' : 'UPDATE', resource: 'NOTICE', resourceId: id });
    return notice;
  },

  async remove(req: Request, id: string) {
    const existing = await repo.find(id, req.user!.role === 'SUPER_ADMIN' ? {} : { schoolId: req.user!.schoolId! });
    if (!existing) throw ApiError.notFound('Notice not found');
    await repo.remove(id);
    await audit(req, { schoolId: existing.schoolId, action: 'DELETE', resource: 'NOTICE', resourceId: id });
  },
};
