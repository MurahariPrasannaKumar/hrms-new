import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();
export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'password';

const cache = new Map<string, string>();
export const tokenFor = async (email: string): Promise<string> => {
  const hit = cache.get(email);
  if (hit) return hit;
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  cache.set(email, res.body.data.accessToken);
  return res.body.data.accessToken;
};

export const as = async (email: string) => {
  const token = await tokenFor(email);
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string, body?: object) => request(app).post(url).set(auth).send(body),
    patch: (url: string, body?: object) => request(app).patch(url).set(auth).send(body),
    del: (url: string) => request(app).delete(url).set(auth),
  };
};
