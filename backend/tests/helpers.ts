import request from 'supertest';
import type { Express } from 'express';

export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'password';

export const tokenFor = async (app: Express, identifier: string) => {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${identifier}: ${res.status}`);
  return { token: res.body.data.accessToken as string, user: res.body.data.user as { id: string; schoolId: string | null } };
};

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
