import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
afterAll(() => prisma.$disconnect());

describe('password policy: only admins manage passwords', () => {
  it.each(['teacher@schoolone.com', 'student@schoolone.com', 'parent@schoolone.com'])(
    '%s cannot change their own password',
    async (email) => {
      const { token } = await tokenFor(app, email);
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set(bearer(token))
        .send({ currentPassword: process.env.SEED_DEMO_PASSWORD ?? 'password', newPassword: 'Another123' });
      expect(res.status).toBe(403);
    },
  );

  it('non-admin accounts get no reset token from forgot-password', async () => {
    const before = await prisma.passwordResetToken.count();
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'teacher@schoolone.com' });
    expect(res.status).toBe(200);
    expect(await prisma.passwordResetToken.count()).toBe(before);
  });

  it('school admin may change their own password; admin can set a teacher password', async () => {
    const admin = await tokenFor(app, 'admin@schoolone.com');
    const bad = await request(app).post('/api/v1/auth/change-password').set(bearer(admin.token)).send({ currentPassword: 'nope', newPassword: 'Another123' });
    expect(bad.status).toBe(400); // reaches the handler (role allowed), wrong current password
    const teacher = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@schoolone.com' } });
    const set = await request(app).post(`/api/v1/users/${teacher.id}/reset-password`).set(bearer(admin.token)).send({ password: 'Teacher4567' });
    expect(set.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'teacher@schoolone.com', password: 'Teacher4567' })).status).toBe(200);
    await prisma.user.update({ where: { id: teacher.id }, data: { passwordHash: await argon2.hash(process.env.SEED_DEMO_PASSWORD ?? 'password') } });
  });
});
