import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { as } from './ops-helpers';

const started = new Date();
let classId: string;
let otherClassId: string;
let subjectId: string;
let entryId: string;
let assignmentId: string;

beforeAll(async () => {
  const teacher = await prisma.teacher.findFirstOrThrow({ where: { user: { email: 'teacher@schoolone.com' } }, include: { classes: true } });
  classId = teacher.classes[0].classId;
  otherClassId = (await prisma.class.findFirstOrThrow({ where: { schoolId: teacher.schoolId, id: { notIn: teacher.classes.map((c) => c.classId) } } })).id;
  subjectId = (await prisma.subject.findFirstOrThrow({ where: { schoolId: teacher.schoolId } })).id;
});

afterAll(async () => {
  await prisma.diaryEntry.deleteMany({ where: { title: { startsWith: 'TEST ' } } });
  await prisma.assignment.deleteMany({ where: { title: { startsWith: 'TEST ' } } });
  await prisma.notification.deleteMany({ where: { type: 'ASSIGNMENT', createdAt: { gte: started } } });
  await prisma.auditLog.deleteMany({ where: { resource: { in: ['DIARY_ENTRY', 'ASSIGNMENT', 'ASSIGNMENT_SUBMISSION'] }, createdAt: { gte: started } } });
  await prisma.$disconnect();
});

describe('diary', () => {
  it('teacher creates homework for an assigned class', async () => {
    const teacher = await as('teacher@schoolone.com');
    const res = await teacher.post('/api/v1/diary', { classId, subjectId, title: 'TEST homework', body: 'Do page 10', isHomework: true, dueDate: new Date(Date.now() + 86_400_000).toISOString() });
    expect(res.status).toBe(201);
    entryId = res.body.data.id;
  });

  it('teacher cannot write to a class they are not assigned to', async () => {
    const teacher = await as('teacher@schoolone.com');
    expect((await teacher.post('/api/v1/diary', { classId: otherClassId, title: 'TEST nope', body: 'x' })).status).toBe(403);
  });

  it('student in the class sees it; parent sees it', async () => {
    for (const email of ['student@schoolone.com', 'parent@schoolone.com']) {
      const res = await (await as(email)).get('/api/v1/diary?isHomework=true&pageSize=100');
      expect(res.status).toBe(200);
      expect(res.body.data.some((e: { id: string }) => e.id === entryId)).toBe(true);
    }
  });

  it('students cannot create/update/delete diary entries', async () => {
    const s = await as('student@schoolone.com');
    expect((await s.post('/api/v1/diary', { classId, title: 'TEST x', body: 'y' })).status).toBe(403);
    expect((await s.patch(`/api/v1/diary/${entryId}`, { title: 'TEST z' })).status).toBe(403);
    expect((await s.del(`/api/v1/diary/${entryId}`)).status).toBe(403);
  });

  it('tenant isolation: other school admin cannot read or change the entry', async () => {
    const other = await as('admin@schooltwo.com');
    expect((await other.get(`/api/v1/diary/${entryId}`)).status).toBe(404);
    expect((await other.patch(`/api/v1/diary/${entryId}`, { title: 'TEST hijack' })).status).toBe(404);
    expect((await other.del(`/api/v1/diary/${entryId}`)).status).toBe(404);
    expect((await other.get('/api/v1/diary?pageSize=100')).body.data.some((e: { id: string }) => e.id === entryId)).toBe(false);
  });

  it('school admin needs a teacherId to author entries', async () => {
    const admin = await as('admin@schoolone.com');
    expect((await admin.post('/api/v1/diary', { classId, title: 'TEST admin', body: 'y' })).status).toBe(400);
  });

  it('teacher updates and deletes their own entry', async () => {
    const teacher = await as('teacher@schoolone.com');
    expect((await teacher.patch(`/api/v1/diary/${entryId}`, { title: 'TEST edited' })).body.data.title).toBe('TEST edited');
    expect((await teacher.del(`/api/v1/diary/${entryId}`)).status).toBe(200);
    expect((await teacher.get(`/api/v1/diary/${entryId}`)).status).toBe(404);
  });
});

describe('assignments', () => {
  it('teacher creates an assignment; students are notified', async () => {
    const teacher = await as('teacher@schoolone.com');
    const res = await teacher.post('/api/v1/assignments', { classId, subjectId, title: 'TEST worksheet', dueDate: new Date(Date.now() + 86_400_000).toISOString() });
    expect(res.status).toBe(201);
    assignmentId = res.body.data.id;
    const notes = await (await as('student@schoolone.com')).get('/api/v1/notifications?type=ASSIGNMENT');
    expect(notes.body.data.length).toBeGreaterThan(0);
  });

  it('student submits (upsert), teacher grades, other school is blocked', async () => {
    const student = await as('student@schoolone.com');
    expect((await student.post(`/api/v1/assignments/${assignmentId}/submissions`, { content: 'answer' })).status).toBe(201);
    expect((await student.post(`/api/v1/assignments/${assignmentId}/submissions`, { content: 'better answer' })).status).toBe(201);
    expect((await student.post(`/api/v1/assignments/${assignmentId}/submissions`, {})).status).toBe(400);

    const teacher = await as('teacher@schoolone.com');
    const subs = await teacher.get(`/api/v1/assignments/${assignmentId}/submissions`);
    expect(subs.body.data).toHaveLength(1);
    const graded = await teacher.patch(`/api/v1/assignments/${assignmentId}/submissions/${subs.body.data[0].id}`, { marks: 9 });
    expect(graded.body.data.marks).toBe(9);
    expect((await student.patch(`/api/v1/assignments/${assignmentId}/submissions/${subs.body.data[0].id}`, { marks: 10 })).status).toBe(403);

    const other = await as('admin@schooltwo.com');
    expect((await other.get(`/api/v1/assignments/${assignmentId}`)).status).toBe(404);
    expect((await other.get(`/api/v1/assignments/${assignmentId}/submissions`)).status).toBe(404);
  });

  it('parents cannot submit', async () => {
    expect((await (await as('parent@schoolone.com')).post(`/api/v1/assignments/${assignmentId}/submissions`, { content: 'x' })).status).toBe(403);
  });
});
