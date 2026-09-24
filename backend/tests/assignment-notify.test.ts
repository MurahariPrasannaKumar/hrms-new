import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let teacher: string, student: string, studentUserId: string;
let classId: string, subjectId: string;
const created: string[] = [];

beforeAll(async () => {
  const [t, s] = await Promise.all(['teacher@schoolone.com', 'student@schoolone.com'].map((e) => tokenFor(app, e)));
  teacher = t.token; student = s.token; studentUserId = s.user.id;
  const st = await prisma.student.findFirstOrThrow({ where: { userId: studentUserId } });
  classId = st.classId!;
  subjectId = (await prisma.subject.findFirstOrThrow({ where: { schoolId: st.schoolId } })).id;
  // the demo teacher must teach the class
  const tr = await prisma.teacher.findFirstOrThrow({ where: { user: { email: 'teacher@schoolone.com' } }, include: { classes: true } });
  if (!tr.classes.some((c) => c.classId === classId)) throw new Error('demo teacher does not teach the demo student class');
});
afterAll(async () => {
  await prisma.assignment.deleteMany({ where: { id: { in: created } } });
  await prisma.notification.deleteMany({ where: { userId: studentUserId, title: { startsWith: 'New assignment: Notify test' } } });
  await prisma.$disconnect();
});

describe('assignment to class', () => {
  it('notifies the class students and shows the assignment to them', async () => {
    const res = await request(app).post('/api/v1/assignments').set(bearer(teacher)).send({ classId, subjectId, title: 'Notify test A', description: 'Read chapter 2' });
    expect(res.status).toBe(201);
    created.push(res.body.data.id);
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: studentUserId, title: 'New assignment: Notify test A' } })).toBe(1));

    const list = await request(app).get('/api/v1/assignments').set(bearer(student));
    expect(list.body.data.some((a: { id: string }) => a.id === res.body.data.id)).toBe(true);
  });

  it('can skip the notification', async () => {
    const res = await request(app).post('/api/v1/assignments').set(bearer(teacher)).send({ classId, subjectId, title: 'Notify test B', notify: false });
    expect(res.status).toBe(201);
    created.push(res.body.data.id);
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.notification.count({ where: { userId: studentUserId, title: 'New assignment: Notify test B' } })).toBe(0);
  });
});

describe('student dashboard', () => {
  it('lists an assignment that has no due date', async () => {
    const res = await request(app).post('/api/v1/assignments').set(bearer(teacher)).send({ classId, subjectId, title: 'Notify test undated', notify: false });
    expect(res.status).toBe(201);
    created.push(res.body.data.id);
    const dash = await request(app).get('/api/v1/dashboard/student').set(bearer(student));
    expect(dash.status).toBe(200);
    expect(dash.body.data.upcomingAssignments.some((a: { id: string }) => a.id === res.body.data.id)).toBe(true);
  });
});

describe('student submission', () => {
  it('reaches the teacher as a notification, shows on the student card, and needs an answer', async () => {
    const a = await request(app).post('/api/v1/assignments').set(bearer(teacher)).send({ classId, subjectId, title: 'Notify test submit', notify: false });
    created.push(a.body.data.id);
    const teacherUserId = (await prisma.teacher.findFirstOrThrow({ where: { user: { email: 'teacher@schoolone.com' } } })).userId;

    expect((await request(app).post(`/api/v1/assignments/${a.body.data.id}/submissions`).set(bearer(student)).send({})).status).toBe(400);
    const sub = await request(app).post(`/api/v1/assignments/${a.body.data.id}/submissions`).set(bearer(student)).send({ content: 'My answer' });
    expect(sub.status).toBe(201);
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: teacherUserId, title: { startsWith: 'Submitted: Notify test submit' } } })).toBe(1));

    const list = await request(app).get('/api/v1/assignments').set(bearer(student));
    expect(list.body.data.find((x: { id: string }) => x.id === a.body.data.id).mySubmission.content).toBe('My answer');
    const seen = await request(app).get(`/api/v1/assignments/${a.body.data.id}/submissions`).set(bearer(teacher));
    expect(seen.body.data).toHaveLength(1);
    await prisma.notification.deleteMany({ where: { userId: teacherUserId, title: { startsWith: 'Submitted: Notify test' } } });

    // Grading shows the marks to that student and notifies them.
    const submissionId = seen.body.data[0].id;
    expect((await request(app).patch(`/api/v1/assignments/${a.body.data.id}/submissions/${submissionId}`).set(bearer(teacher)).send({ marks: 8 })).status).toBe(200);
    const after = await request(app).get('/api/v1/assignments').set(bearer(student));
    expect(after.body.data.find((x: { id: string }) => x.id === a.body.data.id).mySubmission.marks).toBe(8);
    await vi.waitFor(async () => expect(await prisma.notification.count({ where: { userId: studentUserId, title: 'Marks received: Notify test submit' } })).toBe(1));
    await prisma.notification.deleteMany({ where: { userId: studentUserId, title: { startsWith: 'Marks received: Notify test' } } });
  });
});
