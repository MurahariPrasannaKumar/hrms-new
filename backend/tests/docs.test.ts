import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './ops-helpers';

describe('api docs', () => {
  it('serves the OpenAPI document without auth', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    for (const p of ['/auth/login', '/schools', '/students', '/teachers', '/attendance', '/notices', '/diary', '/notifications', '/courses', '/dashboard/admin', '/modules', '/security/audit-logs', '/ai/instasolve', '/files']) {
      expect(res.body.paths[p], p).toBeTruthy();
    }
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
