import { createHmac, timingSafeEqual } from 'node:crypto';

const BUCKET_SECONDS = 6 * 60 * 60;
const LIFETIME_SECONDS = 24 * 60 * 60;

/**
 * Media links are capability URLs: /media/<key>?e=<expiry>&s=<hmac>.
 * They are only ever handed to members of the conversation that owns the file.
 * Expiry is rounded to 6-hour buckets so the same file keeps the same URL for a while,
 * which lets the browser cache it.
 */
export class MediaSigner {
  constructor(
    private readonly key: Buffer,
    private readonly baseUrl: string,
  ) {}

  private sig(objectKey: string, exp: number) {
    return createHmac('sha256', this.key).update(`${objectKey}\n${exp}`).digest('base64url');
  }

  url(objectKey: string, nowMs = Date.now()): string {
    const now = Math.floor(nowMs / 1000);
    const exp = Math.ceil((now + LIFETIME_SECONDS) / BUCKET_SECONDS) * BUCKET_SECONDS;
    const encoded = objectKey.split('/').map(encodeURIComponent).join('/');
    return `${this.baseUrl}/media/${encoded}?e=${exp}&s=${this.sig(objectKey, exp)}`;
  }

  verify(objectKey: string, exp: string | undefined, sig: string | undefined, nowMs = Date.now()): boolean {
    if (!exp || !sig || !/^\d{9,11}$/.test(exp)) return false;
    const e = Number(exp);
    if (e * 1000 < nowMs) return false;
    const expected = Buffer.from(this.sig(objectKey, e));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

export function isSafeObjectKey(key: string): boolean {
  return /^(u|c)\/[0-9a-f-]{36}\/[a-z]+\/[A-Za-z0-9_-]{16,64}\.(webp|mp3|jpg|png)$/.test(key);
}
