import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
afterAll(() => prisma.$disconnect());

const get = async (email: string, path: string) => {
  const { token } = await tokenFor(app, email);
  return request(app).get(`/api/v1/dashboard/${path}`).set(bearer(token));
};

describe('dashboard', () => {
  it('admin dashboard returns aggregates', async () => {
    const res = await get('superadmin@example.com', 'admin');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.stats.totalSchools).toBeGreaterThanOrEqual(2);
    expect(d.stats.totalStudents).toBeGreaterThanOrEqual(40);
    expect(d.charts.studentGrowth).toHaveLength(6);
    expect(d.charts.userActivity).toHaveLength(14);
    expect(d.charts.attendanceTrend.length).toBeGreaterThan(0);
    expect(Array.isArray(d.recentActivity)).toBe(true);
  });

  it('school dashboard is scoped to own school', async () => {
    const res = await get('admin@schoolone.com', 'school');
    expect(res.status).toBe(200);
    expect(res.body.data.stats.totalStudents).toBe(20);
    expect(res.body.data.stats.totalTeachers).toBe(5);
    expect(res.body.data.charts.studentDistribution.reduce((n: number, c: { count: number }) => n + c.count, 0)).toBe(20);
  });

  it('teacher, student and parent dashboards work', async () => {
    const t = await get('teacher@schoolone.com', 'teacher');
    expect(t.status).toBe(200);
    expect(t.body.data.classes.length).toBeGreaterThan(0);
    const s = await get('student@schoolone.com', 'student');
    expect(s.status).toBe(200);
    expect(s.body.data.attendance.total).toBeGreaterThan(0);
    expect(s.body.data.learning.completedLessons).toBeGreaterThanOrEqual(1);
    const p = await get('parent@schoolone.com', 'parent');
    expect(p.status).toBe(200);
    expect(p.body.data.children).toHaveLength(10);
  });

  it('enforces role guards (403) and auth (401)', async () => {
    expect((await get('admin@schoolone.com', 'admin')).status).toBe(403);
    expect((await get('student@schoolone.com', 'school')).status).toBe(403);
    expect((await get('teacher@schoolone.com', 'student')).status).toBe(403);
    expect((await request(app).get('/api/v1/dashboard/admin')).status).toBe(401);
  });
});
