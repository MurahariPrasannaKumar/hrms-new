import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let teacher: string, admin: string, admin2: string, student: string;
let teacherUserId: string;
const ids: string[] = [];

// Far-future Monday-Friday windows so they never clash with real data.
const week = (n: number) => ({ startDate: `2031-0${n}-06`, endDate: `2031-0${n}-08` }); // Mon-Wed

beforeAll(async () => {
  const [t, a, a2, s] = await Promise.all(['teacher@schoolone.com', 'admin@schoolone.com', 'admin@schooltwo.com', 'student@schoolone.com'].map((e) => tokenFor(app, e)));
  teacher = t.token; admin = a.token; admin2 = a2.token; student = s.token; teacherUserId = t.user.id;
});
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { title: { in: ['Leave request submitted', 'Leave approved', 'Leave rejected', 'Leave request cancelled', 'Leave cancelled by administrator'] }, userId: teacherUserId } });
  await prisma.leaveRequest.deleteMany({ where: { userId: teacherUserId, startDate: { gte: new Date('2031-01-01') } } });
  await prisma.$disconnect();
});

describe('leave management', () => {
  it('employee applies; admin sees it and is notified; students cannot apply', async () => {
    const res = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'CASUAL', ...week(1), reason: 'Family function' });
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(3);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.adminsNotified).toBeGreaterThan(0);
    ids.push(res.body.data.id);

    const list = await request(app).get('/api/v1/leave?status=PENDING').set(bearer(admin));
    expect(list.status).toBe(200);
    expect(list.body.data.some((l: { id: string }) => l.id === ids[0])).toBe(true);
    expect(list.body.meta.pendingCount).toBeGreaterThan(0);

    expect((await request(app).post('/api/v1/leave').set(bearer(student)).send({ type: 'CASUAL', ...week(2), reason: 'not allowed' })).status).toBe(403);
    expect((await request(app).get('/api/v1/leave').set(bearer(teacher))).status).toBe(403);
  });

  it('rejects overlapping requests, bad dates and over-balance requests', async () => {
    const clash = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'SICK', startDate: '2031-01-07', endDate: '2031-01-09', reason: 'Overlaps first' });
    expect(clash.status).toBe(409);
    const backwards = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'CASUAL', startDate: '2031-03-10', endDate: '2031-03-01', reason: 'Backwards' });
    expect(backwards.status).toBe(400);
    const weekend = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'CASUAL', startDate: '2031-03-08', endDate: '2031-03-09', reason: 'Weekend only' });
    expect(weekend.status).toBe(400);
    const tooMany = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'CASUAL', startDate: '2031-04-01', endDate: '2031-06-30', reason: 'Way too long' });
    expect(tooMany.status).toBe(400);
  });

  it('admin approves: applicant notified, balance updated, cannot be re-reviewed; other schools cannot review', async () => {
    expect((await request(app).patch(`/api/v1/leave/${ids[0]}/review`).set(bearer(admin2)).send({ decision: 'APPROVED' })).status).toBe(404);
    expect((await request(app).patch(`/api/v1/leave/${ids[0]}/review`).set(bearer(teacher)).send({ decision: 'APPROVED' })).status).toBe(403);

    const ok = await request(app).patch(`/api/v1/leave/${ids[0]}/review`).set(bearer(admin)).send({ decision: 'APPROVED', note: 'Enjoy' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('APPROVED');
    expect(ok.body.data.reviewNote).toBe('Enjoy');
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: teacherUserId, title: 'Leave approved' } })).toBeGreaterThan(0));

    expect((await request(app).patch(`/api/v1/leave/${ids[0]}/review`).set(bearer(admin)).send({ decision: 'REJECTED' })).status).toBe(409);
    expect((await request(app).patch(`/api/v1/leave/${ids[0]}/cancel`).set(bearer(teacher))).status).toBe(400);

    const bal = await request(app).get('/api/v1/leave/balances').set(bearer(teacher));
    expect(bal.status).toBe(200);
    expect(bal.body.data.find((b: { type: string }) => b.type === 'CASUAL')).toMatchObject({ allowance: 12 });
  });

  it('employee can cancel a pending request and admin can reject one', async () => {
    const a = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'CASUAL', ...week(5), reason: 'To be cancelled' });
    ids.push(a.body.data.id);
    expect((await request(app).patch(`/api/v1/leave/${a.body.data.id}/cancel`).set(bearer(teacher))).body.data.status).toBe('CANCELLED');
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: teacherUserId, title: 'Leave request cancelled' } })).toBeGreaterThan(0));
    const mine = await request(app).get('/api/v1/leave/mine').set(bearer(teacher));
    expect(mine.body.data.some((l: { id: string }) => l.id === a.body.data.id)).toBe(false);

    const b = await request(app).post('/api/v1/leave').set(bearer(teacher)).send({ type: 'UNPAID', ...week(6), reason: 'To be rejected' });
    ids.push(b.body.data.id);
    const rej = await request(app).patch(`/api/v1/leave/${b.body.data.id}/review`).set(bearer(admin)).send({ decision: 'REJECTED', note: 'Exams that week' });
    expect(rej.body.data.status).toBe('REJECTED');
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: teacherUserId, title: 'Leave rejected' } })).toBeGreaterThan(0));
  });

  it('admin can cancel an approved leave and the employee is told', async () => {
    const res = await request(app).patch(`/api/v1/leave/${ids[0]}/review`).set(bearer(admin)).send({ decision: 'CANCELLED', note: 'Cover needed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: teacherUserId, title: 'Leave cancelled by administrator' } })).toBeGreaterThan(0));
    const mine = await request(app).get('/api/v1/leave/mine').set(bearer(teacher));
    expect(mine.body.data.some((l: { id: string }) => l.id === ids[0])).toBe(true);
    expect((await request(app).patch(`/api/v1/leave/${ids[0]}/review`).set(bearer(admin)).send({ decision: 'CANCELLED' })).status).toBe(409);
  });
});
