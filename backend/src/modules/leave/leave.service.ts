import type { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { pageArgs, pageMeta } from '../../utils/pagination';
import { weekdaysBetween } from '../attendance/attendance-stats';
import { notificationService } from '../notifications/notification.service';
import type { applyLeaveSchema, listLeaveSchema, listMyLeaveSchema, reviewLeaveSchema } from './leave.validation';

type Apply = z.infer<typeof applyLeaveSchema>;

/** Paid days per calendar year. UNPAID and OTHER are not capped. */
export const ANNUAL_ALLOWANCE: Partial<Record<LeaveType, number>> = { CASUAL: 12, SICK: 10, EARNED: 15 };

const TYPE_LABEL: Record<LeaveType, string> = { CASUAL: 'Casual', SICK: 'Sick', EARNED: 'Earned', UNPAID: 'Unpaid', OTHER: 'Other' };
const utcDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const include = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } } },
  reviewer: { select: { id: true, firstName: true, lastName: true } },
  school: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestInclude;

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const period = (start: Date, end: Date) => (ymd(start) === ymd(end) ? ymd(start) : `${ymd(start)} to ${ymd(end)}`);

const yearBounds = (year: number) => ({ gte: utcDate(`${year}-01-01`), lte: utcDate(`${year}-12-31`) });

async function usedDays(userId: string, year: number) {
  const rows = await prisma.leaveRequest.findMany({
    where: { userId, status: 'APPROVED', startDate: yearBounds(year) },
    select: { type: true, days: true },
  });
  const used: Record<string, number> = {};
  for (const r of rows) used[r.type] = (used[r.type] ?? 0) + r.days;
  return used;
}

/** School admins of a school; a school without one falls back to the platform admins so requests are never lost. */
async function adminRecipients(schoolId: string) {
  const admins = await prisma.user.findMany({ where: { schoolId, status: 'ACTIVE', role: { name: 'SCHOOL_ADMIN' } }, select: { id: true } });
  if (admins.length) return admins;
  return prisma.user.findMany({ where: { status: 'ACTIVE', role: { name: 'SUPER_ADMIN' } }, select: { id: true } });
}

export const leaveService = {
  async balances(userId: string) {
    const year = new Date().getUTCFullYear();
    const used = await usedDays(userId, year);
    const pending = await prisma.leaveRequest.groupBy({ by: ['type'], where: { userId, status: 'PENDING' }, _sum: { days: true } });
    const pendingBy = Object.fromEntries(pending.map((p) => [p.type, p._sum.days ?? 0]));
    return (Object.keys(TYPE_LABEL) as LeaveType[]).map((type) => {
      const allowance = ANNUAL_ALLOWANCE[type] ?? null;
      const u = used[type] ?? 0;
      return { type, allowance, used: u, pending: pendingBy[type] ?? 0, remaining: allowance == null ? null : Math.max(allowance - u, 0) };
    });
  },

  async apply(actor: AuthUser, d: Apply) {
    if (!actor.schoolId) throw ApiError.forbidden('Leave applies to school employees only');
    if (d.endDate < d.startDate) throw ApiError.badRequest('End date cannot be before the start date');
    const days = weekdaysBetween(d.startDate, d.endDate).length;
    if (days === 0) throw ApiError.badRequest('The selected dates fall only on weekends');
    if (days > 60) throw ApiError.badRequest('A single request cannot exceed 60 working days');

    const start = utcDate(d.startDate);
    const end = utcDate(d.endDate);
    const clash = await prisma.leaveRequest.findFirst({
      where: { userId: actor.id, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } },
    });
    if (clash) throw ApiError.conflict(`You already have a ${clash.status.toLowerCase()} leave request for ${period(clash.startDate, clash.endDate)}`);

    const allowance = ANNUAL_ALLOWANCE[d.type];
    if (allowance != null) {
      const year = start.getUTCFullYear();
      const used = (await usedDays(actor.id, year))[d.type] ?? 0;
      if (used + days > allowance) {
        throw ApiError.badRequest(`Not enough ${TYPE_LABEL[d.type].toLowerCase()} leave: ${Math.max(allowance - used, 0)} of ${allowance} days remaining this year, you asked for ${days}`);
      }
    }

    const leave = await prisma.leaveRequest.create({
      data: { schoolId: actor.schoolId, userId: actor.id, type: d.type, startDate: start, endDate: end, days, reason: d.reason },
      include,
    });

    // Tell the school's admins (platform notification + email) and confirm to the applicant.
    const admins = await adminRecipients(actor.schoolId);
    const who = fullName(leave.user);
    void notificationService.notify(
      admins.map((a) => a.id),
      {
        type: 'SYSTEM', link: '/leave', title: `Leave request from ${who}`,
        message: `${who} has requested ${days} working day${days === 1 ? '' : 's'} of ${TYPE_LABEL[d.type].toLowerCase()} leave. Please review it in the admin panel.`,
        email: {
          category: 'Leave management',
          details: [
            { label: 'Employee', value: `${who} (${leave.user.email})` },
            { label: 'Leave type', value: `${TYPE_LABEL[d.type]} leave` },
            { label: 'Dates', value: period(start, end) },
            { label: 'Working days', value: String(days) },
            { label: 'Reason', value: d.reason },
          ],
          action: { label: 'Review request in portal', path: '{area}/leave' },
        },
      },
      ['IN_APP', 'EMAIL'],
    );
    void notificationService.notify(
      [actor.id],
      { type: 'SYSTEM', link: '/leave', title: 'Leave request submitted', message: `Your ${TYPE_LABEL[d.type].toLowerCase()} leave request for ${period(start, end)} (${days} working day${days === 1 ? '' : 's'}) was sent to your administrator for approval. You will be notified once it is reviewed.`, email: { category: 'Leave management', action: { label: 'Open my leave requests', path: '{area}/leave' } } },
      ['IN_APP', 'EMAIL'],
    );
    return { leave, adminsNotified: admins.length };
  },

  async listMine(actor: AuthUser, q: z.infer<typeof listMyLeaveSchema>) {
    // Requests the employee withdrew are hidden; ones an admin cancelled stay visible.
    const where: Prisma.LeaveRequestWhereInput = { userId: actor.id, ...(q.status ? { status: q.status } : { NOT: { status: 'CANCELLED', reviewedById: null } }) };
    const { skip, take } = pageArgs(q);
    const [items, total] = await prisma.$transaction([
      prisma.leaveRequest.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include }),
      prisma.leaveRequest.count({ where }),
    ]);
    return { items, meta: pageMeta(q, total) };
  },

  async cancel(actor: AuthUser, id: string) {
    const leave = await prisma.leaveRequest.findFirst({ where: { id, userId: actor.id } });
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.status !== 'PENDING') throw ApiError.badRequest('Only pending requests can be cancelled');
    const cancelled = await prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' }, include });

    const label = TYPE_LABEL[leave.type].toLowerCase();
    const when = period(leave.startDate, leave.endDate);
    const details = [
      { label: 'Leave type', value: `${TYPE_LABEL[leave.type]} leave` },
      { label: 'Dates', value: when },
      { label: 'Working days', value: String(leave.days) },
      { label: 'Status', value: 'Cancelled' },
    ];
    void notificationService.notify(
      [actor.id],
      {
        type: 'SYSTEM', link: '/leave', title: 'Leave request cancelled',
        message: `You cancelled your ${label} leave request for ${when}. No further action is needed.`,
        email: { category: 'Leave management', details, action: { label: 'Open my leave requests', path: '{area}/leave' } },
      },
      ['IN_APP', 'EMAIL'],
    );
    const who = fullName(cancelled.user);
    void adminRecipients(leave.schoolId).then((admins) => notificationService.notify(
      admins.map((a) => a.id),
      {
        type: 'SYSTEM', link: '/leave', title: `Leave request withdrawn by ${who}`,
        message: `${who} withdrew their ${label} leave request for ${when}. There is nothing to review.`,
        email: { category: 'Leave management', details: [{ label: 'Employee', value: `${who} (${cancelled.user.email})` }, ...details], action: { label: 'Open leave requests', path: '{area}/leave' } },
      },
      ['IN_APP', 'EMAIL'],
    ));
    return cancelled;
  },

  async list(tenant: { schoolId?: string }, q: z.infer<typeof listLeaveSchema>) {
    const where: Prisma.LeaveRequestWhereInput = {
      ...tenant,
      ...(q.status && { status: q.status }),
      ...(q.type && { type: q.type }),
      ...(q.search && {
        user: { OR: [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
        ] },
      }),
    };
    const { skip, take } = pageArgs(q);
    const [items, total, pending] = await prisma.$transaction([
      prisma.leaveRequest.findMany({ where, skip, take, include, orderBy: [{ createdAt: 'desc' }] }),
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.count({ where: { ...tenant, status: 'PENDING' } }),
    ]);
    return { items, meta: { ...pageMeta(q, total), pendingCount: pending } };
  },

  async review(actor: AuthUser, tenant: { schoolId?: string }, id: string, d: z.infer<typeof reviewLeaveSchema>) {
    const leave = await prisma.leaveRequest.findFirst({ where: { id, ...tenant }, include });
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.userId === actor.id) throw ApiError.forbidden('You cannot review your own leave request');
    const status: LeaveStatus = d.decision;
    // Approve/reject only decide pending requests; an admin may also cancel a pending or already-approved one.
    const allowedFrom: LeaveStatus[] = status === 'CANCELLED' ? ['PENDING', 'APPROVED'] : ['PENDING'];
    if (!allowedFrom.includes(leave.status)) throw ApiError.conflict(`This request is already ${leave.status.toLowerCase()}`);

    // Guard against two admins deciding at once: only flip it if its status is still what we read.
    const res = await prisma.leaveRequest.updateMany({
      where: { id, status: leave.status },
      data: { status, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: d.note || null },
    });
    if (!res.count) throw ApiError.conflict('This request was already reviewed');

    const outcome = { APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled by your administrator' }[status as 'APPROVED' | 'REJECTED' | 'CANCELLED'];
    const heading = { APPROVED: 'Leave approved', REJECTED: 'Leave rejected', CANCELLED: 'Leave cancelled by administrator' }[status as 'APPROVED' | 'REJECTED' | 'CANCELLED'];
    const label = TYPE_LABEL[leave.type].toLowerCase();
    const when = period(leave.startDate, leave.endDate);
    void notificationService.notify(
      [leave.userId],
      {
        type: 'SYSTEM', link: '/leave',
        title: heading,
        message: `Your ${label} leave request for ${when} was ${outcome}.${d.note ? `

Note from your administrator: ${d.note}` : ''}`,
        email: {
          category: 'Leave management',
          details: [
            { label: 'Decision', value: status === 'CANCELLED' ? 'Cancelled by administrator' : status === 'APPROVED' ? 'Approved' : 'Rejected' },
            { label: 'Leave type', value: `${TYPE_LABEL[leave.type]} leave` },
            { label: 'Dates', value: when },
            { label: 'Working days', value: String(leave.days) },
            ...(d.note ? [{ label: 'Admin note', value: d.note }] : []),
          ],
          action: { label: 'Open my leave requests', path: '{area}/leave' },
        },
      },
      ['IN_APP', 'EMAIL'],
    );
    return prisma.leaveRequest.findUniqueOrThrow({ where: { id }, include });
  },
};
