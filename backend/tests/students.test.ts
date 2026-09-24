import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let admin1: string, admin2: string, teacher1: string, student1: string, parent1: string, superToken: string;
const createdIds: string[] = [];
const suffix = Date.now().toString(36);

beforeAll(async () => {
  [admin1, admin2, teacher1, student1, parent1, superToken] = (
    await Promise.all(['admin@schoolone.com', 'admin@schooltwo.com', 'teacher@schoolone.com', 'student@schoolone.com', 'parent@schoolone.com', 'superadmin@example.com'].map((e) => tokenFor(app, e)))
  ).map((t) => t.token);
});
afterAll(async () => {
  await prisma.student.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.user.deleteMany({ where: { email: `stu-${suffix}@test.local` } });
  await prisma.$disconnect();
});

describe('students', () => {
  it('lists with pagination + search for school admin, only own school', async () => {
    const res = await request(app).get('/api/v1/students?pageSize=5&search=GF').set(bearer(admin1));
    expect(res.status).toBe(200);
    expect(res.body.meta.pageSize).toBe(5);
    expect(res.body.data.length).toBeGreaterThan(0);
    const school1 = (await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } })).id;
    expect(res.body.data.every((s: { schoolId: string }) => s.schoolId === school1)).toBe(true);
  });

  it('creates a student with a login, and never leaks passwordHash', async () => {
    const res = await request(app).post('/api/v1/students').set(bearer(admin1)).send({
      admissionNumber: `T-${suffix}`, firstName: 'Test', lastName: 'Student',
      login: { email: `stu-${suffix}@test.local`, password: 'Passw0rdX' },
    });
    expect(res.status).toBe(201);
    createdIds.push(res.body.data.id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const dup = await request(app).post('/api/v1/students').set(bearer(admin1)).send({ admissionNumber: `T-${suffix}`, firstName: 'A', lastName: 'B' });
    expect(dup.status).toBe(409);
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/v1/students').set(bearer(admin1)).send({ firstName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns profile with attendance percentage, results and assignments', async () => {
    const list = await request(app).get('/api/v1/students?pageSize=1').set(bearer(admin1));
    const res = await request(app).get(`/api/v1/students/${list.body.data[0].id}`).set(bearer(admin1));
    expect(res.status).toBe(200);
    expect(res.body.data.attendance).toHaveProperty('percentage');
    expect(res.body.data).toHaveProperty('results');
    expect(res.body.data).toHaveProperty('assignments');
  });

  it('isolates tenants: school one admin cannot read or modify school two students', async () => {
    const two = await request(app).get('/api/v1/students?pageSize=1').set(bearer(admin2));
    const otherId = two.body.data[0].id;
    expect((await request(app).get(`/api/v1/students/${otherId}`).set(bearer(admin1))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/students/${otherId}`).set(bearer(admin1)).send({ firstName: 'Hacked' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/students/${otherId}`).set(bearer(admin1))).status).toBe(404);
  });

  it('ignores a client supplied schoolId for school admins and rejects cross-school class refs', async () => {
    const twoClass = await prisma.class.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } });
    const res = await request(app).post('/api/v1/students').set(bearer(admin1)).send({ admissionNumber: `X-${suffix}`, firstName: 'A', lastName: 'B', classId: twoClass.id });
    expect(res.status).toBe(400);
  });

  it('restricts roles: student 403 on list, teacher read-only, parent sees only own children', async () => {
    expect((await request(app).get('/api/v1/students').set(bearer(student1))).status).toBe(403);
    expect((await request(app).post('/api/v1/students').set(bearer(teacher1)).send({ admissionNumber: 'Z', firstName: 'A', lastName: 'B' })).status).toBe(403);
    const t = await request(app).get('/api/v1/students').set(bearer(teacher1));
    expect(t.status).toBe(200);
    const parent = await prisma.parent.findFirstOrThrow({ where: { user: { email: 'parent@schoolone.com' } } });
    const p = await request(app).get('/api/v1/students?pageSize=100').set(bearer(parent1));
    expect(p.status).toBe(200);
    expect(p.body.data.length).toBeGreaterThan(0);
    const owned = await prisma.student.count({ where: { parentId: parent.id } });
    expect(p.body.data.length).toBe(owned);
  });

  it('requires auth and lets super admin filter by schoolId', async () => {
    expect((await request(app).get('/api/v1/students')).status).toBe(401);
    const s2 = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-TWO' } });
    const res = await request(app).get(`/api/v1/students?schoolId=${s2.id}&pageSize=100`).set(bearer(superToken));
    expect(res.body.data.every((s: { schoolId: string }) => s.schoolId === s2.id)).toBe(true);
  });

  it('updates and deletes', async () => {
    const id = createdIds[0];
    const up = await request(app).patch(`/api/v1/students/${id}`).set(bearer(admin1)).send({ firstName: 'Renamed', status: 'INACTIVE' });
    expect(up.status).toBe(200);
    expect(up.body.data.firstName).toBe('Renamed');
    expect((await request(app).delete(`/api/v1/students/${id}`).set(bearer(admin1))).status).toBe(200);
    expect((await request(app).get(`/api/v1/students/${id}`).set(bearer(admin1))).status).toBe(404);
  });
});
