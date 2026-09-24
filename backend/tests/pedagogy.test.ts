import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let admin: string, teacher: string, student: string;
let classId = '', otherClassId = '';
const made: string[] = [];
const video = (over: object = {}) => ({ title: `Video ${Date.now()}`, type: 'VIDEO', area: 'pedagogy', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ...over });

beforeAll(async () => {
  const [a, t, s] = await Promise.all(['admin@schoolone.com', 'teacher@schoolone.com', 'student@schoolone.com'].map((e) => tokenFor(app, e)));
  admin = a.token; teacher = t.token; student = s.token;
  const st = await prisma.student.findFirstOrThrow({ where: { userId: s.user.id } });
  classId = st.classId!;
  const other = await prisma.class.findFirst({ where: { schoolId: st.schoolId, id: { not: classId } } });
  otherClassId = other?.id ?? (await prisma.class.create({ data: { schoolId: st.schoolId, academicYearId: (await prisma.class.findUniqueOrThrow({ where: { id: classId } })).academicYearId, name: `PedOther-${Date.now()}` } })).id;
});
afterAll(async () => {
  await prisma.learningResource.deleteMany({ where: { id: { in: made } } });
  await prisma.class.deleteMany({ where: { id: otherClassId, name: { startsWith: 'PedOther-' } } });
  await prisma.$disconnect();
});

describe('pedagogy LMS', () => {
  it('students cannot post; teachers must pick a class they teach', async () => {
    expect((await request(app).post('/api/v1/resources').set(bearer(student)).send(video({ classId }))).status).toBe(403);
    expect((await request(app).post('/api/v1/resources').set(bearer(teacher)).send(video())).status).toBe(400);
    expect((await request(app).post('/api/v1/resources').set(bearer(teacher)).send(video({ classId: otherClassId }))).status).toBe(403);
  });

  it('a teacher posts to their class; students of that class see it, others do not', async () => {
    const res = await request(app).post('/api/v1/resources').set(bearer(teacher)).send(video({ title: 'Ped mine', classId }));
    expect(res.status).toBe(201);
    made.push(res.body.data.id);

    const seen = await request(app).get('/api/v1/resources?area=pedagogy').set(bearer(student));
    const mine = seen.body.data.find((r: { id: string }) => r.id === res.body.data.id);
    expect(mine).toBeTruthy();
    expect(mine.uploadedBy.firstName).toBeTruthy();

    // an admin can post for another class; the student (not in it) must not see it
    const other = await request(app).post('/api/v1/resources').set(bearer(admin)).send(video({ title: 'Ped other', classId: otherClassId }));
    expect(other.status).toBe(201);
    made.push(other.body.data.id);
    const again = await request(app).get('/api/v1/resources?area=pedagogy').set(bearer(student));
    expect(again.body.data.some((r: { id: string }) => r.id === other.body.data.id)).toBe(false);
  });

  it('students cannot delete; teachers only their own; admins anything', async () => {
    const adminPost = await request(app).post('/api/v1/resources').set(bearer(admin)).send(video({ title: 'Ped admin', classId }));
    made.push(adminPost.body.data.id);
    expect((await request(app).delete(`/api/v1/resources/${adminPost.body.data.id}`).set(bearer(student))).status).toBe(403);
    expect((await request(app).delete(`/api/v1/resources/${adminPost.body.data.id}`).set(bearer(teacher))).status).toBe(403);
    expect((await request(app).delete(`/api/v1/resources/${adminPost.body.data.id}`).set(bearer(admin))).status).toBe(200);

    const own = await request(app).post('/api/v1/resources').set(bearer(teacher)).send(video({ title: 'Ped own', classId }));
    made.push(own.body.data.id);
    expect((await request(app).delete(`/api/v1/resources/${own.body.data.id}`).set(bearer(teacher))).status).toBe(200);
  });
});
