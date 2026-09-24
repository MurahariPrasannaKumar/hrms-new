import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let admin: string, teacher: string, student: string;
let teacherId: string;
let classId: string;
let studentUserId: string;
let originalPairs: { teacherId: string; classId: string; sectionId: string }[] = [];

beforeAll(async () => {
  const [a, t, s] = await Promise.all(['admin@schoolone.com', 'teacher@schoolone.com', 'student@schoolone.com'].map((e) => tokenFor(app, e)));
  admin = a.token; teacher = t.token; student = s.token; studentUserId = s.user.id;
  teacherId = (await prisma.teacher.findFirstOrThrow({ where: { userId: t.user.id } })).id;
  const st = await prisma.student.findFirstOrThrow({ where: { userId: studentUserId } });
  originalPairs = await prisma.teacherClass.findMany({ where: { teacherId } });
  classId = (await prisma.class.findFirstOrThrow({ where: { schoolId: st.schoolId } })).id;
});
afterAll(async () => {
  await prisma.teacherClass.deleteMany({ where: { teacherId } });
  await prisma.teacherClass.createMany({ data: originalPairs });
  await prisma.$disconnect();
});

describe('profile', () => {
  it('returns role-specific profile data for student, teacher and admin', async () => {
    const s = await request(app).get('/api/v1/profile').set(bearer(student));
    expect(s.status).toBe(200);
    expect(s.body.data.student).toHaveProperty('admissionNumber');
    expect(s.body.data.student.class).toHaveProperty('level');
    const t = await request(app).get('/api/v1/profile').set(bearer(teacher));
    expect(t.body.data.teacher).toHaveProperty('employeeId');
    const a = await request(app).get('/api/v1/profile').set(bearer(admin));
    expect(a.body.data.user.role).toBe('SCHOOL_ADMIN');
    expect((await request(app).get('/api/v1/profile')).status).toBe(401);
  });

  it('updates own contact details but never class/role', async () => {
    const res = await request(app).patch('/api/v1/profile').set(bearer(student)).send({ address: '12 Test Street', classId: 'ignored' });
    expect(res.status).toBe(200);
    expect(res.body.data.student.address).toBe('12 Test Street');
  });

  it('teacher picks classes to teach, then can message that class; others cannot', async () => {
    await prisma.teacherClass.deleteMany({ where: { teacherId } });
    const denied = await request(app).post(`/api/v1/classes/${classId}/notify`).set(bearer(teacher)).send({ subject: 'Hi', message: 'Hello class' });
    expect(denied.status).toBe(403);

    const pick = await request(app).put('/api/v1/profile/teaching-classes').set(bearer(teacher)).send({ classIds: [classId] });
    expect(pick.status).toBe(200);
    expect(pick.body.data.map((c: { id: string }) => c.id)).toContain(classId);

    const before = await prisma.notification.count({ where: { userId: studentUserId, title: { contains: 'Hi' } } });
    const sent = await request(app).post(`/api/v1/classes/${classId}/notify`).set(bearer(teacher)).send({ subject: 'Hi', message: 'Hello class' });
    expect(sent.status).toBe(200);
    expect(sent.body.data.students).toBeGreaterThan(0);
    const after = await prisma.notification.count({ where: { userId: studentUserId, title: { contains: 'Hi' } } });
    expect(after).toBeGreaterThan(before);

    expect((await request(app).post(`/api/v1/classes/${classId}/notify`).set(bearer(student)).send({ subject: 'x', message: 'y' })).status).toBe(403);
    await prisma.notification.deleteMany({ where: { title: { contains: ': Hi' } } });
  });

  it('teacher can enrol an unassigned student, but only into a class they teach', async () => {
    const school = (await prisma.class.findUniqueOrThrow({ where: { id: classId } })).schoolId;
    const year = (await prisma.class.findUniqueOrThrow({ where: { id: classId } })).academicYearId;
    const other = await prisma.class.create({ data: { schoolId: school, academicYearId: year, name: `Other-${Date.now()}` } });
    const stu = await prisma.student.create({ data: { schoolId: school, admissionNumber: `ENR${Date.now()}`, firstName: 'Un', lastName: 'Assigned' } });
    try {
      await request(app).put('/api/v1/profile/teaching-classes').set(bearer(teacher)).send({ classIds: [classId] });
      const denied = await request(app).patch(`/api/v1/students/${stu.id}`).set(bearer(teacher)).send({ classId: other.id });
      expect(denied.status).toBe(403);
      const okRes = await request(app).patch(`/api/v1/students/${stu.id}`).set(bearer(teacher)).send({ classId });
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.classId).toBe(classId);
    } finally {
      await prisma.student.delete({ where: { id: stu.id } });
      await prisma.class.delete({ where: { id: other.id } });
    }
  });
});
