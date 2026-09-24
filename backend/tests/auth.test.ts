import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

const app = createApp();
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'password';

const login = (identifier: string, password = PASSWORD) =>
  request(app).post('/api/v1/auth/login').send({ identifier, password });

afterAll(() => prisma.$disconnect());

describe('auth', () => {
  it('logs in and returns tokens, profile, permissions and never the hash', async () => {
    const res = await login('admin@schoolone.com');
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('SCHOOL_ADMIN');
    expect(res.body.data.user.permissions).toContain('students.read');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
  });

  it('rejects a wrong password with a generic error', async () => {
    const res = await login('teacher@schoolone.com', 'wrong-password');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates the request body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const first = (await login('student@schoolone.com')).body.data.refreshToken as string;
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
    const afterReuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: rotated.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the session so the access token stops working', async () => {
    const { accessToken, refreshToken } = (await login('parent@schoolone.com')).body.data;
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`)).status).toBe(200);
    await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`)).status).toBe(401);
  });

  it('requires a token for protected routes', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });
});
