import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
const emails = ['profile.teacher@schoolone.com', 'profile.student@schoolone.com'];
let superT = '';
let schoolId = '';

beforeAll(async () => {
  superT = (await tokenFor(app, 'superadmin@example.com')).token;
  schoolId = (await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } })).id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.student.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { resource: 'USER', resourceId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('creating users from the admin panel', () => {
  it.each([
    ['TEACHER', emails[0]],
    ['STUDENT', emails[1]],
  ])('%s gets a login and a linked profile row, and can sign in', async (role, email) => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(bearer(superT))
      .send({ email, password: 'Passw0rdX', firstName: 'Profile', lastName: role, role, schoolId });
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;

    const profile = role === 'TEACHER'
      ? await prisma.teacher.findUnique({ where: { userId: id } })
      : await prisma.student.findUnique({ where: { userId: id } });
    expect(profile?.schoolId).toBe(schoolId);

    const login = await request(app).post('/api/v1/auth/login').send({ identifier: email, password: 'Passw0rdX' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe(role);
    expect(await prisma.auditLog.count({ where: { resource: 'USER', resourceId: id, action: 'CREATE' } })).toBe(1);
  });
});
