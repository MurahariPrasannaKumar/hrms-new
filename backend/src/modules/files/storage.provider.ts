import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

export interface StorageProvider {
  readonly name: 'local' | 's3';
  save(key: string, data: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private root = path.resolve(env.UPLOAD_DIR);

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw ApiError.badRequest('Invalid storage key');
    return full;
  }
  async save(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, data);
  }
  async read(key: string) {
    const full = this.resolve(key);
    try {
      await fsp.access(full);
    } catch {
      throw ApiError.notFound('File content not found');
    }
    return fs.createReadStream(full);
  }
  async remove(key: string) {
    await fsp.rm(this.resolve(key), { force: true });
  }
}

/** Placeholder for the S3-compatible implementation (needs an SDK + S3_* env vars). */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const;
  private fail(): never {
    throw new ApiError(501, 'STORAGE_NOT_CONFIGURED', 'S3 storage is not implemented yet');
  }
  async save(): Promise<void> { this.fail(); }
  async read(): Promise<Readable> { return this.fail(); }
  async remove(): Promise<void> { this.fail(); }
}

let instance: StorageProvider | undefined;
export const getStorage = (): StorageProvider =>
  (instance ??= env.STORAGE_PROVIDER === 's3' ? new S3StorageProvider() : new LocalStorageProvider());
