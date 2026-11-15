import { Router } from 'express';
import type { AppContext } from '../context.js';
import { AppError } from '../lib/errors.js';
import { isSafeObjectKey } from '../media/signing.js';

/**
 * GET /media/<key>?e=..&s=..
 * Verifies our HMAC capability, then redirects to a short-lived Supabase signed URL
 * so the bytes stream straight from Supabase's CDN (with Range support for audio seeking).
 */
export function mediaRoutes(ctx: AppContext) {
  const r = Router();
  const cache = new Map<string, { url: string; until: number }>();
  const SIGN_TTL = 60 * 60;

  r.get('/{*key}', async (req, res) => {
    const raw = (req.params as { key?: string[] | string }).key;
    const key = Array.isArray(raw) ? raw.join('/') : String(raw ?? '');
    const { e, s } = req.query as Record<string, string | undefined>;
    if (!isSafeObjectKey(key) || !ctx.signer.verify(key, e, s)) {
      throw new AppError(403, 'invalid_media_link', 'This link has expired.');
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (ctx.storage.read) {
      const file = await ctx.storage.read(key);
      if (!file) throw new AppError(404, 'media_not_found', 'File not found.');
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
      return res.send(file.data);
    }

    const now = Date.now();
    let hit = cache.get(key);
    if (!hit || hit.until < now) {
      const url = await ctx.storage.signedUrl(key, SIGN_TTL);
      hit = { url, until: now + (SIGN_TTL - 600) * 1000 };
      cache.set(key, hit);
      if (cache.size > 5000) {
        for (const [k, v] of cache) if (v.until < now) cache.delete(k);
        if (cache.size > 5000) cache.clear();
      }
    }
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.redirect(302, hit.url);
  });

  return r;
}
