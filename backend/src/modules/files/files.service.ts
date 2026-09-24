import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { getStorage } from './storage.provider';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Lesson videos may be larger than other files. */
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'video/mp4', 'video/webm',
]);

export const sanitizeFilename = (name: string) =>
  // eslint-disable-next-line no-control-regex
  path.basename(name.replace(/\\/g, '/')).replace(/[\x00-\x1f"<>|:*?]/g, '_').slice(0, 200) || 'file';

const canAccess = (u: AuthUser, f: { schoolId: string | null; uploadedById: string }) =>
  u.role === 'SUPER_ADMIN' || f.schoolId === null || f.schoolId === u.schoolId;

export const filesService = {
  async upload(u: AuthUser, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    const originalName = sanitizeFilename(file.originalname);
    const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const storageKey = `${u.schoolId ?? 'platform'}/${randomUUID()}${ext}`;
    const storage = getStorage();
    await storage.save(storageKey, file.buffer, file.mimetype);
    return prisma.file.create({
      data: {
        schoolId: u.schoolId, uploadedById: u.id, originalName, mimeType: file.mimetype,
        size: file.size, storageKey, provider: storage.name,
      },
      select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
    });
  },

  async get(u: AuthUser, id: string) {
    const f = await prisma.file.findUnique({ where: { id } });
    if (!f || !canAccess(u, f)) throw ApiError.notFound('File not found');
    return f;
  },

  async open(u: AuthUser, id: string) {
    const f = await this.get(u, id);
    return { file: f, stream: await getStorage().read(f.storageKey) };
  },

  async remove(u: AuthUser, id: string) {
    const f = await this.get(u, id);
    const isAdmin = u.role === 'SUPER_ADMIN' || u.role === 'SCHOOL_ADMIN';
    if (f.uploadedById !== u.id && !isAdmin) throw ApiError.forbidden();
    await getStorage().remove(f.storageKey);
    await prisma.file.delete({ where: { id } });
    return f;
  },
};
