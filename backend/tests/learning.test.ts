import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { createMiniApp, tokenFor } from './helpers/mini-app';

const app = createMiniApp();
let admin1: string, admin2: string, teacher1: string, student1: string, parent1: string, superAdmin: string;
const created: { courses: string[]; resources: string[]; paths: string[] } = { courses: [], resources: [], paths: [] };
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  [admin1, admin2, teacher1, student1, parent1, superAdmin] = await Promise.all([
    tokenFor(app, 'admin@schoolone.com'), tokenFor(app, 'admin@schooltwo.com'), tokenFor(app, 'teacher@schoolone.com'),
    tokenFor(app, 'student@schoolone.com'), tokenFor(app, 'parent@schoolone.com'), tokenFor(app, 'superadmin@example.com'),
  ]);
});
afterAll(async () => {
  await prisma.learningPath.deleteMany({ where: { id: { in: created.paths } } });
  await prisma.course.deleteMany({ where: { id: { in: created.courses } } });
  await prisma.learningResource.deleteMany({ where: { id: { in: created.resources } } });
  await prisma.$disconnect();
});

describe('courses', () => {
  let courseId: string;
  let lessonIds: string[];

  it('teacher creates a course with nested modules/lessons in their own school', async () => {
    const res = await request(app).post('/api/v1/courses').set(auth(teacher1)).send({
      title: 'TEST Geometry', category: 'Mathematics',
      modules: [{ title: 'Shapes', lessons: [{ title: 'Triangles' }, { title: 'Circles', sortOrder: 1 }] }],
    });
    expect(res.status).toBe(201);
    courseId = res.body.data.id;
    created.courses.push(courseId);
    lessonIds = res.body.data.modules[0].lessons.map((l: { id: string }) => l.id);
    expect(res.body.data.schoolId).toBeTruthy();
  });

  it('student cannot create courses (RBAC)', async () => {
    const res = await request(app).post('/api/v1/courses').set(auth(student1)).send({ title: 'x' });
    expect(res.status).toBe(403);
  });

  it('parent has no learning access', async () => {
    expect((await request(app).get('/api/v1/courses').set(auth(parent1))).status).toBe(403);
  });

  it('validates bodies', async () => {
    const res = await request(app).post('/api/v1/courses').set(auth(teacher1)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('tenant isolation: other school cannot see or modify the course', async () => {
    expect((await request(app).get(`/api/v1/courses/${courseId}`).set(auth(admin2))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/courses/${courseId}`).set(auth(admin2)).send({ title: 'hacked' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/courses/${courseId}`).set(auth(admin2))).status).toBe(404);
    const list = await request(app).get('/api/v1/courses?search=TEST').set(auth(admin2));
    expect(list.body.data.map((c: { id: string }) => c.id)).not.toContain(courseId);
  });

  it('student sees course, completes lessons and progress reaches 100%', async () => {
    const detail = await request(app).get(`/api/v1/courses/${courseId}`).set(auth(student1));
    expect(detail.status).toBe(200);
    expect(detail.body.data.completionPercent).toBe(0);
    const first = await request(app).post(`/api/v1/lessons/${lessonIds[0]}/complete`).set(auth(student1));
    expect(first.body.data.completionPercent).toBe(50);
    await request(app).post(`/api/v1/lessons/${lessonIds[1]}/complete`).set(auth(student1));
    const done = await request(app).get(`/api/v1/courses/${courseId}`).set(auth(student1));
    expect(done.body.data.completionPercent).toBe(100);
    const progress = await request(app).get('/api/v1/learning/progress').set(auth(student1));
    expect(progress.body.data.items.find((i: { courseId: string }) => i.courseId === courseId).completionPercent).toBe(100);
    const certs = await request(app).get('/api/v1/learning/certificates').set(auth(student1));
    expect(certs.body.data.placeholder).toBe(true);
    expect(certs.body.data.items.map((c: { courseId: string }) => c.courseId)).toContain(courseId);
  });

  it('other school student cannot complete the lesson', async () => {
    const other = await tokenFor(app, 'student@schooltwo.com');
    expect((await request(app).post(`/api/v1/lessons/${lessonIds[0]}/complete`).set(auth(other))).status).toBe(404);
  });

  it('unpublished courses are hidden from students', async () => {
    await request(app).patch(`/api/v1/courses/${courseId}`).set(auth(admin1)).send({ published: false });
    expect((await request(app).get(`/api/v1/courses/${courseId}`).set(auth(student1))).status).toBe(404);
    expect((await request(app).get(`/api/v1/courses/${courseId}`).set(auth(admin1))).status).toBe(200);
  });

  it('school admin cannot edit platform-wide courses; super admin can create them', async () => {
    const bad = await request(app).post('/api/v1/courses').set(auth(superAdmin)).send({ title: 'TEST global' });
    expect(bad.status).toBe(400);
    const g = await request(app).post('/api/v1/courses').set(auth(superAdmin)).send({ title: 'TEST global', global: true });
    expect(g.status).toBe(201);
    created.courses.push(g.body.data.id);
    expect(g.body.data.schoolId).toBeNull();
    expect((await request(app).patch(`/api/v1/courses/${g.body.data.id}`).set(auth(admin1)).send({ title: 'x' })).status).toBe(403);
    expect((await request(app).get(`/api/v1/courses/${g.body.data.id}`).set(auth(admin2))).status).toBe(200);
  });

  it('learning paths order courses and compute progress', async () => {
    const p = await request(app).post('/api/v1/learning/paths').set(auth(admin1)).send({ title: 'TEST Path', courseIds: [courseId] });
    expect(p.status).toBe(201);
    created.paths.push(p.body.data.id);
    const list = await request(app).get('/api/v1/learning/paths').set(auth(student1));
    const mine = list.body.data.find((x: { id: string }) => x.id === p.body.data.id);
    expect(mine.courses).toHaveLength(1);
    const bad = await request(app).post('/api/v1/learning/paths').set(auth(admin2)).send({ title: 'x', courseIds: [courseId] });
    expect(bad.status).toBe(400);
  });
});

describe('resources', () => {
  it('filters by area and lists categories; students cannot write', async () => {
    // Pedagogy posts by teachers must name a class they teach.
    const taught = await prisma.teacherClass.findFirstOrThrow({ where: { teacher: { user: { email: 'teacher@schoolone.com' } } } });
    const r = await request(app).post('/api/v1/resources').set(auth(teacher1)).send({
      title: 'TEST Resource', area: 'pedagogy', category: 'TEST Category', type: 'LESSON_PLAN', classId: taught.classId,
    });
    expect(r.status).toBe(201);
    created.resources.push(r.body.data.id);

    const list = await request(app).get('/api/v1/resources?area=pedagogy&search=TEST').set(auth(student1));
    expect(list.body.data.map((x: { id: string }) => x.id)).toContain(r.body.data.id);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const smart = await request(app).get('/api/v1/resources?area=smart-class&search=TEST').set(auth(student1));
    expect(smart.body.data).toHaveLength(0);

    const cats = await request(app).get('/api/v1/resources/categories?area=pedagogy').set(auth(student1));
    expect(cats.body.data.map((c: { name: string }) => c.name)).toContain('TEST Category');

    expect((await request(app).post('/api/v1/resources').set(auth(student1)).send({ title: 'x' })).status).toBe(403);
    // tenant isolation
    expect((await request(app).get(`/api/v1/resources/${r.body.data.id}`).set(auth(admin2))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/resources/${r.body.data.id}`).set(auth(admin2))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/resources/${r.body.data.id}`).set(auth(teacher1)).send({ title: 'TEST Renamed' })).status).toBe(200);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/resources')).status).toBe(401);
  });
});
