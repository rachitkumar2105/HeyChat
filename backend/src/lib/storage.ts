import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors.js';

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** A short-lived URL the browser can fetch the object from directly. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
  remove(keys: string[]): Promise<void>;
  /** Local storage serves bytes itself; remote storage returns null and redirects instead. */
  read?(key: string): Promise<{ data: Buffer; contentType: string } | null>;
}

export class SupabaseStorage implements Storage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
  ) {}

  async put(key: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(this.bucket).upload(key, data, {
      contentType,
      upsert: false,
      cacheControl: '31536000',
    });
    if (error) throw new AppError(502, 'storage_error', 'Could not store the file. Please try again.');
  }

  async signedUrl(key: string, ttlSeconds: number) {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(key, ttlSeconds);
    if (error || !data) throw new AppError(404, 'media_not_found', 'File not found.');
    return data.signedUrl;
  }

  async remove(keys: string[]) {
    const clean = keys.filter(Boolean);
    for (let i = 0; i < clean.length; i += 100) {
      await this.client.storage.from(this.bucket).remove(clean.slice(i, i + 100));
    }
  }
}

/** Disk-backed storage for local development and tests. */
export class LocalStorage implements Storage {
  constructor(private readonly root: string) {}

  private file(key: string) {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(path.resolve(this.root) + path.sep)) throw new Error('path escape');
    return resolved;
  }

  async put(key: string, data: Buffer, contentType: string) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data);
    await writeFile(`${f}.type`, contentType);
  }

  async signedUrl(): Promise<string> {
    throw new Error('LocalStorage serves files directly');
  }

  async read(key: string) {
    try {
      const f = this.file(key);
      const [data, contentType] = await Promise.all([readFile(f), readFile(`${f}.type`, 'utf8')]);
      return { data, contentType };
    } catch {
      return null;
    }
  }

  async remove(keys: string[]) {
    await Promise.all(
      keys.filter(Boolean).flatMap((k) => [rm(this.file(k), { force: true }), rm(`${this.file(k)}.type`, { force: true })]),
    );
  }
}
