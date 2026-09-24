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
const created: string[] = [];

beforeAll(async () => {
  superT = (await tokenFor(app, 'superadmin@example.com')).token;
  const a = await tokenFor(app, 'admin@schoolone.com');
  adminOne = a.token;
  schoolOneId = a.user.schoolId!;
  teacher = (await tokenFor(app, 'teacher@schoolone.com')).token;
  schoolTwoId = (await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-TWO' } })).id;
});

afterAll(async () => {
  await prisma.school.deleteMany({ where: { id: { in: created } } });
  await prisma.auditLog.deleteMany({ where: { resource: 'SCHOOL', resourceId: { in: created } } });
  await prisma.$disconnect();
});

describe('schools', () => {
  it('super admin lists with pagination and search', async () => {
    const res = await request(app).get('/api/v1/schools?search=greenfield&pageSize=5').set(bearer(superT));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('super admin creates, updates, deactivates and deletes a school with audit logs', async () => {
    const create = await request(app).post('/api/v1/schools').set(bearer(superT)).send({ name: 'Test School', code: 'tst-01' });
    expect(create.status).toBe(201);
    expect(create.body.data.code).toBe('TST-01');
    const id = create.body.data.id as string;
    created.push(id);

    const dup = await request(app).post('/api/v1/schools').set(bearer(superT)).send({ name: 'Dup', code: 'TST-01' });
    expect(dup.status).toBe(409);

    const patch = await request(app).patch(`/api/v1/schools/${id}`).set(bearer(superT)).send({ status: 'INACTIVE' });
    expect(patch.body.data.status).toBe('INACTIVE');
    expect(await prisma.auditLog.count({ where: { resource: 'SCHOOL', resourceId: id } })).toBeGreaterThanOrEqual(2);

    expect((await request(app).delete(`/api/v1/schools/${id}`).set(bearer(superT))).status).toBe(200);
    expect((await request(app).get(`/api/v1/schools/${id}`).set(bearer(superT))).status).toBe(404);
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/v1/schools').set(bearer(superT)).send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('school admin cannot list, create or delete schools (403)', async () => {
    expect((await request(app).get('/api/v1/schools').set(bearer(adminOne))).status).toBe(403);
    expect((await request(app).post('/api/v1/schools').set(bearer(adminOne)).send({ name: 'Nope', code: 'NOPE' })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/schools/${schoolOneId}`).set(bearer(adminOne))).status).toBe(403);
  });

  it('tenant isolation: school one admin cannot read or edit school two', async () => {
    expect((await request(app).get(`/api/v1/schools/${schoolTwoId}`).set(bearer(adminOne))).status).toBe(403);
    expect((await request(app).patch(`/api/v1/schools/${schoolTwoId}`).set(bearer(adminOne)).send({ principal: 'Hacker' })).status).toBe(403);
    expect((await request(app).get(`/api/v1/schools/${schoolOneId}`).set(bearer(adminOne))).status).toBe(200);
  });

  it('school admin cannot change code or status of own school', async () => {
    const res = await request(app).patch(`/api/v1/schools/${schoolOneId}`).set(bearer(adminOne)).send({ code: 'HACK', status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe('SCH-ONE');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('teacher gets 403 and no token gets 401', async () => {
    expect((await request(app).get(`/api/v1/schools/${schoolOneId}`).set(bearer(teacher))).status).toBe(403);
    expect((await request(app).get('/api/v1/schools')).status).toBe(401);
  });
});
