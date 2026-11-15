import { Router } from 'express';
import { z } from 'zod';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/passwords.js';
import { newRefreshSecret, parseRefreshToken, signAccessToken } from '../auth/tokens.js';
import { presentUser, type AppContext } from '../context.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { limiters, parse, requireAuth } from '../lib/http.js';
import type { UserRow } from '../types.js';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'use 3-20 letters, numbers or underscores');

const passwordSchema = z
  .string()
  .min(8, 'must be at least 8 characters')
  .max(128, 'must be at most 128 characters')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'must contain a letter and a number');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'is required')
  .max(40, 'must be at most 40 characters')
  .refine((s) => !/[\u0000-\u001f\u007f]/.test(s), 'contains invalid characters');

const RegisterBody = z.object({ username: usernameSchema, displayName: displayNameSchema, password: passwordSchema });
const LoginBody = z.object({ username: z.string().trim().toLowerCase().max(40), password: z.string().max(128) });
const RefreshBody = z.object({ refreshToken: z.string().max(200) });
const ChangePasswordBody = z.object({ currentPassword: z.string().max(128), newPassword: passwordSchema });

export function authRoutes(ctx: AppContext) {
  const r = Router();
  const { config, db } = ctx;

  async function issueSession(user: UserRow, userAgent: string | undefined, family: string | null = null) {
    const { secret, hash } = newRefreshSecret();
    const sessionId = await db.call<string>('hc_create_session', {
      p_user: user.id,
      p_family: family,
      p_token_hash: hash,
      p_user_agent: userAgent ?? null,
      p_ttl_seconds: config.auth.refreshTtlSeconds,
    });
    return tokensFor(user, sessionId, secret);
  }

  function tokensFor(user: UserRow, sessionId: string, secret: string) {
    return {
      accessToken: signAccessToken(config, { sub: user.id, tv: user.tokenVersion ?? 0, sid: sessionId }),
      refreshToken: `${sessionId}.${secret}`,
      accessTokenExpiresIn: config.auth.accessTtlSeconds,
      user: presentUser(ctx, user),
    };
  }

  r.post('/register', limiters.auth, async (req, res) => {
    const body = parse(RegisterBody, req.body);
    const passwordHash = await hashPassword(body.password);
    const user = await db.call<UserRow>('hc_register', {
      p_username: body.username,
      p_display_name: body.displayName,
      p_password_hash: passwordHash,
    });
    ctx.log.info({ userId: user.id }, 'user registered');
    res.status(201).json(await issueSession(user, req.get('user-agent')));
  });

  r.post('/login', limiters.auth, async (req, res) => {
    const body = parse(LoginBody, req.body);
    const user = await db.call<UserRow | null>('hc_get_user_auth', { p_username: body.username });
    if (!user?.passwordHash) {
      await burnPasswordCheck(body.password);
      throw new AppError(401, 'invalid_credentials', 'Incorrect username or password.');
    }
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      throw new AppError(401, 'invalid_credentials', 'Incorrect username or password.');
    }
    res.json(await issueSession(user, req.get('user-agent')));
  });

  r.post('/refresh', limiters.refresh, async (req, res) => {
    const { refreshToken } = parse(RefreshBody, req.body);
    const { sessionId, hash } = parseRefreshToken(refreshToken);
    const { secret, hash: newHash } = newRefreshSecret();
    const result = await db.call<{ error?: string; sessionId?: string; user?: UserRow }>('hc_rotate_session', {
      p_session: sessionId,
      p_token_hash: hash,
      p_new_hash: newHash,
      p_user_agent: req.get('user-agent') ?? null,
      p_ttl_seconds: config.auth.refreshTtlSeconds,
    });
    if (result.error || !result.sessionId || !result.user) {
      if (result.error === 'reused') ctx.log.warn({ sessionId }, 'refresh token reuse detected; family revoked');
      throw unauthorized(result.error === 'expired' ? 'session_expired' : 'invalid_refresh_token');
    }
    res.json(tokensFor(result.user, result.sessionId, secret));
  });

  r.post('/logout', async (req, res) => {
    const { refreshToken } = parse(RefreshBody, req.body);
    try {
      const { sessionId, hash } = parseRefreshToken(refreshToken);
      await db.call('hc_revoke_session', { p_session: sessionId, p_token_hash: hash });
    } catch {
      /* logging out with a bad token is still a successful logout */
    }
    res.status(204).end();
  });

  r.get('/me', requireAuth(ctx), async (req, res) => {
    const user = await db.call<UserRow | null>('hc_get_user', { p_user: req.userId });
    if (!user) throw unauthorized('user_gone');
    res.json({ user: presentUser(ctx, user) });
  });

  r.post('/logout-all', requireAuth(ctx), async (req, res) => {
    const { tokenVersion } = await db.call<{ tokenVersion: number }>('hc_revoke_all_sessions', { p_user: req.userId });
    ctx.tokenVersions.set(req.userId!, { tv: tokenVersion, at: Date.now() });
    ctx.hub.kick(req.userId!);
    res.status(204).end();
  });

  r.post('/change-password', limiters.auth, requireAuth(ctx), async (req, res) => {
    const body = parse(ChangePasswordBody, req.body);
    const user = await db.call<UserRow | null>('hc_get_user_auth_by_id', { p_user: req.userId });
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw new AppError(400, 'wrong_password', 'Your current password is incorrect.');
    }
    const { tokenVersion } = await db.call<{ tokenVersion: number }>('hc_change_password', {
      p_user: user.id,
      p_new_hash: await hashPassword(body.newPassword),
    });
    ctx.tokenVersions.set(user.id, { tv: tokenVersion, at: Date.now() });
    ctx.hub.kick(user.id);
    // Keep the current device signed in with a fresh session.
    res.json(await issueSession({ ...user, tokenVersion }, req.get('user-agent')));
  });

  return r;
}
