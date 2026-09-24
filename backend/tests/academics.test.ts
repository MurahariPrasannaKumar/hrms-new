import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let admin1: string, admin2: string, teacher1: string, student1: string;
const suffix = Date.now().toString(36);
const created = { years: [] as string[], subjects: [] as string[] };

beforeAll(async () => {
  [admin1, admin2, teacher1, student1] = (await Promise.all(['admin@schoolone.com', 'admin@schooltwo.com', 'teacher@schoolone.com', 'student@schoolone.com'].map((e) => tokenFor(app, e)))).map((t) => t.token);
});
afterAll(async () => {
  await prisma.academicYear.deleteMany({ where: { id: { in: created.years } } });
  await prisma.subject.deleteMany({ where: { id: { in: created.subjects } } });
  await prisma.$disconnect();
});

describe('academics', () => {
  it('lists classes with sections and student counts', async () => {
    const res = await request(app).get('/api/v1/classes').set(bearer(admin1));
    expect(res.status).toBe(200);
    expect(res.body.data[0].sections.length).toBeGreaterThan(0);
    expect(res.body.data[0]._count).toHaveProperty('students');
  });

  it('CRUD for subjects, with 409 on duplicate code and audit logging', async () => {
    const res = await request(app).post('/api/v1/subjects').set(bearer(admin1)).send({ name: 'Art', code: `art${suffix}` });
    expect(res.status).toBe(201);
    created.subjects.push(res.body.data.id);
    expect(res.body.data.code).toBe(`ART${suffix}`.toUpperCase());
    expect((await request(app).post('/api/v1/subjects').set(bearer(admin1)).send({ name: 'Art2', code: `art${suffix}` })).status).toBe(409);
    expect((await request(app).patch(`/api/v1/subjects/${res.body.data.id}`).set(bearer(admin1)).send({ name: 'Fine Art' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { resource: 'SUBJECT', resourceId: res.body.data.id } })).toBe(2);
    expect((await request(app).delete(`/api/v1/subjects/${res.body.data.id}`).set(bearer(admin1))).status).toBe(200);
  });

  it('academic year: only one current year per school', async () => {
    const res = await request(app).post('/api/v1/academic-years').set(bearer(admin1)).send({ name: `Y-${suffix}`, startDate: '2030-06-01', endDate: '2031-03-31', isCurrent: true });
    expect(res.status).toBe(201);
    created.years.push(res.body.data.id);
    const current = await prisma.academicYear.count({ where: { schoolId: res.body.data.schoolId, isCurrent: true } });
    expect(current).toBe(1);
    // restore the seeded current year
    const seeded = await prisma.academicYear.findFirstOrThrow({ where: { schoolId: res.body.data.schoolId, name: '2025-26' } });
    await request(app).patch(`/api/v1/academic-years/${seeded.id}`).set(bearer(admin1)).send({ isCurrent: true });
    expect((await request(app).post('/api/v1/academic-years').set(bearer(admin1)).send({ name: 'bad', startDate: '2030-06-01', endDate: '2029-01-01' })).status).toBe(400);
  });

  it('rejects cross-school references (tenant isolation)', async () => {
    const yearTwo = await prisma.academicYear.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } });
    const classTwo = await prisma.class.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } });
    const subjectOne = await prisma.subject.findFirstOrThrow({ where: { school: { code: 'SCH-ONE' } } });
    expect((await request(app).post('/api/v1/classes').set(bearer(admin1)).send({ academicYearId: yearTwo.id, name: 'Grade X' })).status).toBe(400);
    expect((await request(app).post('/api/v1/sections').set(bearer(admin1)).send({ classId: classTwo.id, name: 'Z' })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/classes/${classTwo.id}`).set(bearer(admin1)).send({ name: 'Hacked' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/subjects/${subjectOne.id}`).set(bearer(admin2))).status).toBe(404);
    const list = await request(app).get('/api/v1/subjects?pageSize=100').set(bearer(admin2));
    expect(list.body.data.some((s: { id: string }) => s.id === subjectOne.id)).toBe(false);
  });

  it('exam results: entry validates class membership and max marks', async () => {
    const cls = await prisma.class.findFirstOrThrow({ where: { school: { code: 'SCH-ONE' } } });
    const year = await prisma.academicYear.findFirstOrThrow({ where: { id: cls.academicYearId } });
    const subject = await prisma.subject.findFirstOrThrow({ where: { school: { code: 'SCH-ONE' } } });
    const exam = await request(app).post('/api/v1/exams').set(bearer(admin1)).send({ academicYearId: year.id, classId: cls.id, subjectId: subject.id, name: `Exam-${suffix}`, date: '2030-01-10', maxMarks: 50 });
    expect(exam.status).toBe(201);
    const student = await prisma.student.findFirstOrThrow({ where: { classId: cls.id } });
    const foreign = await prisma.student.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } });
    const put = (results: unknown[]) => request(app).put(`/api/v1/exams/${exam.body.data.id}/results`).set(bearer(admin1)).send({ results });
    expect((await put([{ studentId: foreign.id, marks: 10 }])).status).toBe(400);
    expect((await put([{ studentId: student.id, marks: 99 }])).status).toBe(400);
    expect((await put([{ studentId: student.id, marks: 42, grade: 'A' }])).status).toBe(200);
    const got = await request(app).get(`/api/v1/exams/${exam.body.data.id}/results`).set(bearer(admin1));
    expect(got.body.data.results[0].marks).toBe(42);
    expect((await request(app).delete(`/api/v1/exams/${exam.body.data.id}`).set(bearer(admin1))).status).toBe(200);
  });

  it('RBAC: teachers can manage academics, students only read; anonymous rejected', async () => {
    expect((await request(app).get('/api/v1/classes').set(bearer(teacher1))).status).toBe(200);
    expect((await request(app).get('/api/v1/subjects').set(bearer(student1))).status).toBe(200);
    const ts = await request(app).post('/api/v1/subjects').set(bearer(teacher1)).send({ name: 'TeacherSubj', code: `ts${suffix}` });
    expect(ts.status).toBe(201);
    created.subjects.push(ts.body.data.id);
    expect((await request(app).post('/api/v1/subjects').set(bearer(student1)).send({ name: 'X', code: 'X' })).status).toBe(403);
    expect((await request(app).get('/api/v1/classes')).status).toBe(401);
  });
});
