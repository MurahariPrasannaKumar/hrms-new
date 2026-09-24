import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let superT = '';
let adminOne = '';
let teacher = '';
let schoolOneId = '';
let schoolTwoId = '';
const emails = ['tmp.user1@schoolone.com', 'tmp.user2@schooltwo.com'];

beforeAll(async () => {
  superT = (await tokenFor(app, 'superadmin@example.com')).token;
  const a = await tokenFor(app, 'admin@schoolone.com');
  adminOne = a.token;
  schoolOneId = a.user.schoolId!;
  teacher = (await tokenFor(app, 'teacher@schoolone.com')).token;
  schoolTwoId = (await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-TWO' } })).id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { resource: 'USER', resourceId: { in: users.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

const body = (email: string, role = 'STAFF') => ({ email, password: 'Passw0rdX', firstName: 'Tmp', lastName: 'User', role });

describe('users', () => {
  let createdId = '';
  let otherSchoolUserId = '';

  it('school admin creates a user pinned to own school, ignoring client schoolId', async () => {
    const res = await request(app).post('/api/v1/users').set(bearer(adminOne)).send({ ...body(emails[0]), schoolId: schoolTwoId });
    expect(res.status).toBe(201);
    expect(res.body.data.schoolId).toBe(schoolOneId);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    createdId = res.body.data.id;
  });

  it('school admin cannot create SUPER_ADMIN', async () => {
    const res = await request(app).post('/api/v1/users').set(bearer(adminOne)).send(body('tmp.super@schoolone.com', 'SUPER_ADMIN'));
    expect(res.status).toBe(403);
  });

  it('super admin must supply schoolId for school users', async () => {
    expect((await request(app).post('/api/v1/users').set(bearer(superT)).send(body(emails[1]))).status).toBe(400);
    const ok = await request(app).post('/api/v1/users').set(bearer(superT)).send({ ...body(emails[1]), schoolId: schoolTwoId });
    expect(ok.status).toBe(201);
    otherSchoolUserId = ok.body.data.id;
  });

  it('tenant isolation: school one admin cannot see, edit, delete or reset school two users', async () => {
    const h = bearer(adminOne);
    expect((await request(app).get(`/api/v1/users/${otherSchoolUserId}`).set(h)).status).toBe(404);
    expect((await request(app).patch(`/api/v1/users/${otherSchoolUserId}`).set(h).send({ firstName: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/users/${otherSchoolUserId}`).set(h)).status).toBe(404);
    expect((await request(app).post(`/api/v1/users/${otherSchoolUserId}/reset-password`).set(h).send({ password: 'Newpass123' })).status).toBe(404);
    const list = await request(app).get('/api/v1/users?pageSize=100').set(h);
    expect(list.body.data.every((u: { schoolId: string }) => u.schoolId === schoolOneId)).toBe(true);
    const spoof = await request(app).get(`/api/v1/users?schoolId=${schoolTwoId}&pageSize=100`).set(h);
    expect(spoof.body.data.every((u: { schoolId: string }) => u.schoolId === schoolOneId)).toBe(true);
  });

  it('filters by role and searches', async () => {
    const res = await request(app).get('/api/v1/users?role=STAFF&search=tmp.user1').set(bearer(adminOne));
    expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([createdId]);
  });

  it('updates, resets password once, and deactivates (revoking sessions)', async () => {
    const upd = await request(app).patch(`/api/v1/users/${createdId}`).set(bearer(adminOne)).send({ firstName: 'Renamed' });
    expect(upd.body.data.firstName).toBe('Renamed');

    const weak = await request(app).post(`/api/v1/users/${createdId}/reset-password`).set(bearer(adminOne)).send({ password: 'short' });
    expect(weak.status).toBe(400);
    const reset = await request(app).post(`/api/v1/users/${createdId}/reset-password`).set(bearer(adminOne)).send({ password: 'AdminSet123' });
    expect(reset.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: emails[0], password: 'AdminSet123' });
    expect(login.status).toBe(200);
    expect(login.body.data.mustChangePassword).toBe(false);

    const del = await request(app).delete(`/api/v1/users/${createdId}`).set(bearer(adminOne));
    expect(del.body.data.status).toBe('INACTIVE');
    expect((await request(app).get('/api/v1/auth/me').set(bearer(login.body.data.accessToken))).status).toBe(401);
    expect(await prisma.auditLog.count({ where: { resource: 'USER', resourceId: createdId } })).toBeGreaterThanOrEqual(3);
  });

  it('teacher gets 403; admin cannot deactivate self', async () => {
    expect((await request(app).get('/api/v1/users').set(bearer(teacher))).status).toBe(403);
    const me = await tokenFor(app, 'admin@schoolone.com');
    expect((await request(app).delete(`/api/v1/users/${me.user.id}`).set(bearer(me.token))).status).toBe(400);
  });
});
