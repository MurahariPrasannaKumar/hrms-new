import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let admin1: string, admin2: string, teacher1: string;
const suffix = Date.now().toString(36);
const email = `teach-${suffix}@test.local`;
let teacherId: string;

beforeAll(async () => {
  [admin1, admin2, teacher1] = (await Promise.all(['admin@schoolone.com', 'admin@schooltwo.com', 'teacher@schoolone.com'].map((e) => tokenFor(app, e)))).map((t) => t.token);
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('teachers', () => {
  it('creates user+teacher, no hash leaked; duplicate email conflicts', async () => {
    const body = { email, password: 'Passw0rdX', firstName: 'Tea', lastName: 'Cher', employeeId: `E-${suffix}` };
    const res = await request(app).post('/api/v1/teachers').set(bearer(admin1)).send(body);
    expect(res.status).toBe(201);
    teacherId = res.body.data.id;
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect((await request(app).post('/api/v1/teachers').set(bearer(admin1)).send({ ...body, employeeId: 'other' })).status).toBe(409);
  });

  it('lists with search and pagination', async () => {
    const res = await request(app).get(`/api/v1/teachers?search=${suffix}`).set(bearer(admin1));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('assigns subjects and classes and reports workload; rejects foreign ids', async () => {
    const sub = await prisma.subject.findFirstOrThrow({ where: { school: { code: 'SCH-ONE' } } });
    const sec = await prisma.section.findFirstOrThrow({ where: { school: { code: 'SCH-ONE' } } });
    expect((await request(app).put(`/api/v1/teachers/${teacherId}/subjects`).set(bearer(admin1)).send({ subjectIds: [sub.id] })).status).toBe(200);
    expect((await request(app).put(`/api/v1/teachers/${teacherId}/classes`).set(bearer(admin1)).send({ assignments: [{ classId: sec.classId, sectionId: sec.id }] })).status).toBe(200);
    const detail = await request(app).get(`/api/v1/teachers/${teacherId}`).set(bearer(admin1));
    expect(detail.body.data.workload.subjects).toBe(1);
    expect(detail.body.data.workload.sections).toBe(1);

    const foreignSub = await prisma.subject.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } });
    expect((await request(app).put(`/api/v1/teachers/${teacherId}/subjects`).set(bearer(admin1)).send({ subjectIds: [foreignSub.id] })).status).toBe(400);
  });

  it('isolates tenants and enforces RBAC', async () => {
    expect((await request(app).get(`/api/v1/teachers/${teacherId}`).set(bearer(admin2))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/teachers/${teacherId}`).set(bearer(admin2))).status).toBe(404);
    expect((await request(app).get('/api/v1/teachers').set(bearer(teacher1))).status).toBe(403);
    expect((await request(app).get('/api/v1/teachers')).status).toBe(401);
  });

  it('updates and deactivates (soft delete)', async () => {
    const up = await request(app).patch(`/api/v1/teachers/${teacherId}`).set(bearer(admin1)).send({ firstName: 'Renamed', qualification: 'PhD' });
    expect(up.status).toBe(200);
    expect(up.body.data.user.firstName).toBe('Renamed');
    expect((await request(app).delete(`/api/v1/teachers/${teacherId}`).set(bearer(admin1))).status).toBe(200);
    const t = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, include: { user: true } });
    expect(t.user.status).toBe('INACTIVE');
  });
});
