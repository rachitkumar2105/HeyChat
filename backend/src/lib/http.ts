import type { NextFunction, Request, Response } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import { z, type ZodType } from 'zod';
import { verifyAccessToken } from '../auth/tokens.js';
import type { AppContext } from '../context.js';
import type { UserRow } from '../types.js';
import { AppError, badRequest, unauthorized } from './errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    sessionId?: string;
  }
}

export function parse<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const field = first?.path.join('.') || 'input';
    throw badRequest('validation_error', first ? `${field}: ${first.message}` : 'Invalid input.', r.error.issues);
  }
  return r.data;
}

const TV_CACHE_MS = 60_000;

/** Verifies the token and confirms it was not revoked by a password change or "sign out everywhere". */
export async function authenticate(ctx: AppContext, token: string) {
  const claims = verifyAccessToken(ctx.config, token);
  const cached = ctx.tokenVersions.get(claims.sub);
  let tv = cached && Date.now() - cached.at < TV_CACHE_MS ? cached.tv : undefined;
  if (tv === undefined) {
    const user = await ctx.db.call<UserRow | null>('hc_get_user', { p_user: claims.sub });
    if (!user) throw unauthorized('user_gone', 'This account no longer exists.');
    tv = user.tokenVersion ?? 0;
    ctx.tokenVersions.set(claims.sub, { tv, at: Date.now() });
  }
  if (tv !== claims.tv) throw unauthorized('token_revoked');
  return claims;
}

export function requireAuth(ctx: AppContext) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return next(unauthorized('missing_token'));
    try {
      const claims = await authenticate(ctx, h.slice(7).trim());
      req.userId = claims.sub;
      req.sessionId = claims.sid;
      next();
    } catch (e) {
      next(e);
    }
  };
}

const limitHandler = (_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError(429, 'rate_limited', 'Too many requests. Please slow down and try again shortly.'));

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

export const limiters = {
  global: rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: ipKey, handler: limitHandler }),
  auth: rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: ipKey, handler: limitHandler }),
  refresh: rateLimit({ windowMs: 15 * 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: ipKey, handler: limitHandler }),
  send: rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => req.userId ?? ipKey(req), handler: limitHandler }),
  upload: rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => req.userId ?? ipKey(req), handler: limitHandler }),
  search: rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => req.userId ?? ipKey(req), handler: limitHandler }),
};

export function upload(maxBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 8 * 1024, parts: 12 },
  }).single('file');
}

export function errorHandler(ctx: AppContext) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let e: AppError;
    if (err instanceof AppError) e = err;
    else if (err instanceof multer.MulterError) {
      e = err.code === 'LIMIT_FILE_SIZE'
        ? new AppError(413, 'file_too_large', 'That file is too large.')
        : badRequest('bad_upload', 'The upload was malformed.');
    } else if ((err as { type?: string }).type === 'entity.too.large') {
      e = new AppError(413, 'payload_too_large', 'Request is too large.');
    } else if ((err as { type?: string }).type === 'entity.parse.failed') {
      e = badRequest('invalid_json', 'Malformed JSON body.');
    } else {
      ctx.log.error({ err, path: req.path }, 'unhandled error');
      e = new AppError(500, 'internal_error', 'Something went wrong on our side.');
    }
    if (e.status >= 500 && err instanceof AppError) ctx.log.error({ err, path: req.path }, e.code);
    res.status(e.status).json({ error: { code: e.code, message: e.message } });
  };
}
