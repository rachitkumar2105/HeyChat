import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../auth/passwords.js';
import { presentUser, type AppContext } from '../context.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { limiters, parse, requireAuth, upload } from '../lib/http.js';
import { processAvatar } from '../media/image.js';
import type { UserRow } from '../types.js';
import { displayNameSchema } from './auth.js';

const SearchQuery = z.object({ q: z.string().trim().min(1).max(40) });
const ProfileBody = z
  .object({
    displayName: displayNameSchema.optional(),
    bio: z.string().trim().max(160, 'must be at most 160 characters').optional(),
  })
  .refine((b) => b.displayName !== undefined || b.bio !== undefined, 'nothing to update');
const IdParam = z.object({ id: z.uuid() });
const DeleteBody = z.object({ password: z.string().max(128) });

export const newObjectId = () => randomBytes(18).toString('base64url');

export function userRoutes(ctx: AppContext) {
  const r = Router();
  const { db, storage, hub } = ctx;
  r.use(requireAuth(ctx));

  /** Notify everyone who shares a chat with this user that their profile changed. */
  async function broadcastProfile(user: UserRow) {
    const partners = await db.call<string[]>('hc_partner_ids', { p_user: user.id });
    const payload = { user: presentUser(ctx, user) };
    for (const id of [...partners, user.id]) hub.toUser(id, 'user:updated', payload);
  }

  r.get('/search', limiters.search, async (req, res) => {
    const { q } = parse(SearchQuery, req.query);
    const users = await db.call<UserRow[]>('hc_search_users', { p_user: req.userId, p_query: q, p_limit: 20 });
    res.json({ users: users.map((u) => presentUser(ctx, u)) });
  });

  r.patch('/me', async (req, res) => {
    const body = parse(ProfileBody, req.body);
    const user = await db.call<UserRow>('hc_update_profile', {
      p_user: req.userId,
      p_display_name: body.displayName ?? null,
      p_bio: body.bio ?? null,
    });
    await broadcastProfile(user);
    res.json({ user: presentUser(ctx, user) });
  });

  r.post('/me/avatar', limiters.upload, upload(ctx.config.limits.avatarBytes), async (req, res) => {
    if (!req.file) throw badRequest('file_required', 'Choose an image to upload.');
    const data = await processAvatar(req.file.buffer);
    const key = `u/${req.userId}/avatar/${newObjectId()}.webp`;
    await storage.put(key, data, 'image/webp');
    const { user, oldPath } = await db.call<{ user: UserRow; oldPath: string | null }>('hc_set_avatar', {
      p_user: req.userId,
      p_path: key,
    });
    if (oldPath) storage.remove([oldPath]).catch((err) => ctx.log.warn({ err }, 'old avatar cleanup failed'));
    await broadcastProfile(user);
    res.json({ user: presentUser(ctx, user) });
  });

  r.delete('/me/avatar', async (req, res) => {
    const { user, oldPath } = await db.call<{ user: UserRow; oldPath: string | null }>('hc_set_avatar', {
      p_user: req.userId,
      p_path: null,
    });
    if (oldPath) storage.remove([oldPath]).catch((err) => ctx.log.warn({ err }, 'avatar cleanup failed'));
    await broadcastProfile(user);
    res.json({ user: presentUser(ctx, user) });
  });

  r.post('/me/delete', limiters.auth, async (req, res) => {
    const { password } = parse(DeleteBody, req.body);
    const me = await db.call<UserRow | null>('hc_get_user_auth_by_id', { p_user: req.userId });
    if (!me?.passwordHash || !(await verifyPassword(me.passwordHash, password))) {
      throw new AppError(400, 'wrong_password', 'Your password is incorrect.');
    }
    const partners = await db.call<string[]>('hc_partner_ids', { p_user: me.id });
    const { paths } = await db.call<{ paths: string[] }>('hc_delete_account', { p_user: me.id });
    storage.remove(paths).catch((err) => ctx.log.warn({ err }, 'account media cleanup failed'));
    ctx.tokenVersions.delete(me.id);
    for (const id of partners) hub.toUser(id, 'user:deleted', { userId: me.id });
    hub.kick(me.id);
    ctx.log.info({ userId: me.id }, 'account deleted');
    res.status(204).end();
  });

  r.get('/:id', async (req, res) => {
    const { id } = parse(IdParam, req.params);
    const user = await db.call<UserRow | null>('hc_get_user', { p_user: id });
    if (!user) throw notFound('user_not_found', 'User not found.');
    res.json({ user: presentUser(ctx, user) });
  });

  r.post('/:id/block', async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await db.call('hc_set_block', { p_user: req.userId, p_other: id, p_block: true }));
  });

  r.delete('/:id/block', async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await db.call('hc_set_block', { p_user: req.userId, p_other: id, p_block: false }));
  });

  return r;
}
