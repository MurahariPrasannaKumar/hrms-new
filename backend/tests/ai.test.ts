import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { MockProvider } from '../src/modules/ai/ai.provider';
import { createMiniApp, tokenFor } from './helpers/mini-app';

const app = createMiniApp();
let s1: string, s2: string, t1: string, p1: string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const convIds: string[] = [];
const started = new Date();

beforeAll(async () => {
  [s1, s2, t1, p1] = await Promise.all([
    tokenFor(app, 'student@schoolone.com'), tokenFor(app, 'student@schooltwo.com'),
    tokenFor(app, 'teacher@schoolone.com'), tokenFor(app, 'parent@schoolone.com'),
  ]);
});
afterAll(async () => {
  await prisma.aIConversation.deleteMany({ where: { id: { in: convIds } } });
  await prisma.aIRequestLog.deleteMany({ where: { createdAt: { gte: started }, module: { in: ['v-buddy', 'instasolve'] } } });
  await prisma.$disconnect();
});

describe('mock provider', () => {
  it('is deterministic', async () => {
    const p = new MockProvider();
    const a = await p.solveQuestion('2+2?', { hasImage: false });
    const b = await p.solveQuestion('2+2?', { hasImage: false });
    expect(a).toEqual(b);
    expect((await p.generateStudyPlan({ subject: 'Math', goal: 'exam', days: 3 })).result).toHaveLength(3);
  });
});

describe('v-buddy', () => {
  it('chats, persists history and logs metadata only', async () => {
    const first = await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(s1)).send({ message: 'SECRET-PROMPT what is a fraction?' });
    expect(first.status).toBe(200);
    const cid = first.body.data.conversationId as string;
    convIds.push(cid);
    expect(first.body.data.message.role).toBe('assistant');

    const second = await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(s1)).send({ conversationId: cid, message: 'give an example' });
    expect(second.body.data.conversationId).toBe(cid);

    const conv = await request(app).get(`/api/v1/ai/v-buddy/conversations/${cid}`).set(auth(s1));
    expect(conv.body.data.messages).toHaveLength(4);

    const list = await request(app).get('/api/v1/ai/v-buddy/conversations').set(auth(s1));
    expect(list.body.data.map((c: { id: string }) => c.id)).toContain(cid);

    await new Promise((r) => setTimeout(r, 200));
    const logs = await prisma.aIRequestLog.findMany({ where: { module: 'v-buddy', createdAt: { gte: started } } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0].provider).toBe('mock');
    expect(JSON.stringify(logs)).not.toContain('SECRET-PROMPT');
  });

  it("conversations are private to their owner", async () => {
    const mine = await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(t1)).send({ message: 'teacher private' });
    convIds.push(mine.body.data.conversationId);
    const cid = mine.body.data.conversationId;
    expect((await request(app).get(`/api/v1/ai/v-buddy/conversations/${cid}`).set(auth(s1))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/ai/v-buddy/conversations/${cid}`).set(auth(s1))).status).toBe(404);
    expect((await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(s1)).send({ conversationId: cid, message: 'hi' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/ai/v-buddy/conversations/${cid}`).set(auth(t1))).status).toBe(200);
  });

  it('validates input and suggestions work', async () => {
    expect((await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(s1)).send({ message: '' })).status).toBe(400);
    const s = await request(app).get('/api/v1/ai/v-buddy/suggestions').set(auth(s1));
    expect(s.body.data.length).toBeGreaterThan(0);
  });

  it('is gated by module (disabled for school two) and by ai.use permission', async () => {
    const off = await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(s2)).send({ message: 'hello' });
    expect(off.status).toBe(403);
    expect(off.body.error.code).toBe('MODULE_DISABLED');
    expect((await request(app).post('/api/v1/ai/v-buddy/chat').set(auth(p1)).send({ message: 'hello' })).status).toBe(403);
    expect((await request(app).post('/api/v1/ai/v-buddy/chat').send({ message: 'hello' })).status).toBe(401);
  });

  it('generates a study plan', async () => {
    const r = await request(app).post('/api/v1/ai/v-buddy/study-plan').set(auth(s1)).send({ subject: 'Science', goal: 'Pass mid-term', days: 5 });
    expect(r.body.data.plan).toHaveLength(5);
  });
});

describe('instasolve', () => {
  it('solves for school two, disabled for school one', async () => {
    const ok = await request(app).post('/api/v1/ai/instasolve').set(auth(s2)).send({ question: 'What is 12 x 12?' });
    expect(ok.status).toBe(200);
    for (const k of ['explanation', 'answer', 'relatedConcepts', 'steps']) expect(ok.body.data).toHaveProperty(k);
    const off = await request(app).post('/api/v1/ai/instasolve').set(auth(s1)).send({ question: 'x' });
    expect(off.status).toBe(403);
    expect(off.body.error.code).toBe('MODULE_DISABLED');
  });

  it('rejects a fileId that is not the caller\'s image', async () => {
    const r = await request(app).post('/api/v1/ai/instasolve').set(auth(s2)).send({ question: 'q', fileId: '00000000-0000-4000-8000-000000000000' });
    expect(r.status).toBe(400);
  });
});
