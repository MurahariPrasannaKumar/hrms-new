import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/config/database';
import { sanitizeFilename } from '../src/modules/files/files.service';
import { createMiniApp, tokenFor } from './helpers/mini-app';

const app = createMiniApp();
let t1: string, s1: string, a2: string;
const fileIds: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  [t1, s1, a2] = await Promise.all([tokenFor(app, 'teacher@schoolone.com'), tokenFor(app, 'student@schoolone.com'), tokenFor(app, 'admin@schooltwo.com')]);
});
afterAll(async () => {
  const rows = await prisma.file.findMany({ where: { id: { in: fileIds } } });
  for (const r of rows) await fs.rm(path.resolve(env.UPLOAD_DIR, r.storageKey), { force: true });
  await prisma.file.deleteMany({ where: { id: { in: fileIds } } });
  await prisma.$disconnect();
});

describe('files', () => {
  it('sanitizes filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('a<b>:c.pdf')).toBe('a_b__c.pdf');
  });

  let id: string;
  it('uploads with a random storage key and downloads the same bytes', async () => {
    const up = await request(app).post('/api/v1/files').set(auth(t1)).attach('file', Buffer.from('hello world'), { filename: '../evil name.txt', contentType: 'text/plain' });
    expect(up.status).toBe(201);
    id = up.body.data.id;
    fileIds.push(id);
    expect(up.body.data.originalName).toBe('evil name.txt');
    const row = await prisma.file.findUniqueOrThrow({ where: { id } });
    expect(row.storageKey).not.toContain('evil');
    const dl = await request(app).get(`/api/v1/files/${id}`).set(auth(s1)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.status).toBe(200);
    expect((dl.body as Buffer).toString()).toBe('hello world');
    expect(dl.headers['content-disposition']).toMatch(/attachment/);
  });

  it('enforces tenant isolation on download and delete', async () => {
    expect((await request(app).get(`/api/v1/files/${id}`).set(auth(a2))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/files/${id}`).set(auth(a2))).status).toBe(404);
  });

  it('only the uploader or an admin may delete', async () => {
    expect((await request(app).delete(`/api/v1/files/${id}`).set(auth(s1))).status).toBe(403);
  });

  it('rejects disallowed mime types, missing file and oversize files', async () => {
    const bad = await request(app).post('/api/v1/files').set(auth(t1)).attach('file', Buffer.from('MZ'), { filename: 'a.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(415);
    expect((await request(app).post('/api/v1/files').set(auth(t1))).status).toBe(400);
    const big = await request(app).post('/api/v1/files').set(auth(t1)).attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'big.txt', contentType: 'text/plain' });
    expect(big.status).toBe(413);
  });

  it('requires auth', async () => {
    expect((await request(app).get(`/api/v1/files/${id}`)).status).toBe(401);
  });

  it('uploader can delete, removing bytes and row', async () => {
    const row = await prisma.file.findUniqueOrThrow({ where: { id } });
    expect((await request(app).delete(`/api/v1/files/${id}`).set(auth(t1))).status).toBe(200);
    expect(await prisma.file.findUnique({ where: { id } })).toBeNull();
    await expect(fs.access(path.resolve(env.UPLOAD_DIR, row.storageKey))).rejects.toBeTruthy();
  });
});
