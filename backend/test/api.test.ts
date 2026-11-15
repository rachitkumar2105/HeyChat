/**
 * End-to-end API tests: real Express app + Socket.IO + the real SQL functions on a local
 * Postgres (TEST_DATABASE_URL), with files on local disk instead of Supabase Storage.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { pino } from 'pino';
import sharp from 'sharp';
import { io as ioc, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createContext } from '../src/context.js';
import { PgDb } from '../src/lib/db.js';
import { LocalStorage } from '../src/lib/storage.js';
import { attachRealtime } from '../src/realtime/socket.js';

const DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/heychat_test?host=/tmp';
const ORIGIN = 'http://localhost:5173';

let server: Server;
let base: string;
let pool: pg.Pool;
let api: ReturnType<typeof request>;

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string };
}

const auth = (s: Session) => ({ Authorization: `Bearer ${s.accessToken}` });

async function register(username: string, displayName = username) {
  const r = await api.post('/api/auth/register').set('Origin', ORIGIN).send({ username, displayName, password: 'secret123' });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as Session;
}

function connect(s: Session): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = ioc(base, { auth: { token: s.accessToken }, transports: ['websocket'], extraHeaders: { Origin: ORIGIN } });
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', reject);
  });
}

function next<T = any>(sock: Socket, event: string, timeout = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    sock.once(event, (p: T) => {
      clearTimeout(t);
      resolve(p);
    });
  });
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DB_URL });
  const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  await pool.query('truncate app_users, auth_sessions, conversations, conversation_members, chat_messages, message_reactions, user_blocks cascade');

  const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', APP_SECRET: 'x'.repeat(40), PORT: '7999' } as NodeJS.ProcessEnv);
  const storage = new LocalStorage(mkdtempSync(path.join(tmpdir(), 'hc-media-')));
  const ctx = createContext(config, new PgDb(pool), storage, pino({ level: 'silent' }));
  server = createServer(createApp(ctx));
  attachRealtime(ctx, server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Media URLs are built from publicUrl; point it at the ephemeral port.
  (ctx.signer as unknown as { baseUrl: string }).baseUrl = base;
  api = request(base);
});

afterAll(async () => {
  server?.close();
  await pool?.end();
});

describe('auth', () => {
  it('registers, rejects duplicates and weak input', async () => {
    const a = await register('alice_1', 'Alice');
    expect(a.user.username).toBe('alice_1');
    expect(a.refreshToken).toMatch(/^[0-9a-f-]{36}\./);
    expect((a as any).user.passwordHash).toBeUndefined();

    const dup = await api.post('/api/auth/register').send({ username: 'ALICE_1', displayName: 'x', password: 'secret123' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('username_taken');

    const weak = await api.post('/api/auth/register').send({ username: 'bob', displayName: 'Bob', password: 'short' });
    expect(weak.status).toBe(400);
    const badName = await api.post('/api/auth/register').send({ username: 'a b', displayName: 'Bob', password: 'secret123' });
    expect(badName.status).toBe(400);
  });

  it('logs in with the right password only, with a generic error', async () => {
    const ok = await api.post('/api/auth/login').send({ username: 'Alice_1', password: 'secret123' });
    expect(ok.status).toBe(200);
    const bad = await api.post('/api/auth/login').send({ username: 'alice_1', password: 'wrong999' });
    const unknown = await api.post('/api/auth/login').send({ username: 'nobody_here', password: 'wrong999' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.error.message).toBe(unknown.body.error.message);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const s = await register('rotator');
    const r1 = await api.post('/api/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(s.refreshToken);

    // Replaying the old token = theft. Both old and new tokens must die.
    const replay = await api.post('/api/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(replay.status).toBe(401);
    const after = await api.post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it('requires a valid bearer token', async () => {
    expect((await api.get('/api/auth/me')).status).toBe(401);
    expect((await api.get('/api/auth/me').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('sign out everywhere invalidates existing access tokens', async () => {
    const s = await register('everywhere');
    expect((await api.get('/api/auth/me').set(auth(s))).status).toBe(200);
    expect((await api.post('/api/auth/logout-all').set(auth(s))).status).toBe(204);
    expect((await api.get('/api/auth/me').set(auth(s))).status).toBe(401);
    expect((await api.post('/api/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401);
  });

  it('change password keeps this device and needs the current password', async () => {
    const s = await register('changer');
    const wrong = await api.post('/api/auth/change-password').set(auth(s)).send({ currentPassword: 'nope', newPassword: 'newpass123' });
    expect(wrong.status).toBe(400);
    const ok = await api.post('/api/auth/change-password').set(auth(s)).send({ currentPassword: 'secret123', newPassword: 'newpass123' });
    expect(ok.status).toBe(200);
    expect((await api.get('/api/auth/me').set(auth(ok.body))).status).toBe(200);
    expect((await api.post('/api/auth/login').send({ username: 'changer', password: 'newpass123' })).status).toBe(200);
  });
});

describe('messaging', () => {
  let alice: Session;
  let bob: Session;
  let eve: Session;
  let convId: string;

  beforeAll(async () => {
    alice = (await api.post('/api/auth/login').send({ username: 'alice_1', password: 'secret123' })).body;
    bob = await register('bob_2', 'Bob Builder');
    eve = await register('eve_3', 'Eve');
  });

  it('finds people and opens one direct chat per pair', async () => {
    const found = await api.get('/api/users/search?q=bob').set(auth(alice));
    expect(found.status).toBe(200);
    expect(found.body.users.map((u: any) => u.username)).toContain('bob_2');

    const c1 = await api.post('/api/conversations').set(auth(alice)).send({ userId: bob.user.id });
    const c2 = await api.post('/api/conversations').set(auth(bob)).send({ userId: alice.user.id });
    expect(c1.status).toBe(200);
    expect(c1.body.conversation.id).toBe(c2.body.conversation.id);
    expect(c1.body.conversation.peer.username).toBe('bob_2');
    convId = c1.body.conversation.id;

    const self = await api.post('/api/conversations').set(auth(alice)).send({ userId: alice.user.id });
    expect(self.status).toBe(400);
  });

  it('delivers messages in real time with receipts and typing', async () => {
    const bobSock = await connect(bob);
    const aliceSock = await connect(alice);

    const incoming = next(bobSock, 'message:new');
    const sent = await api
      .post(`/api/conversations/${convId}/messages`)
      .set(auth(alice))
      .send({ body: '  Hello <b>Bob</b>  ', clientId: 'client-msg-0001', replyToId: null });
    expect(sent.status).toBe(201);
    expect(sent.body.message.body).toBe('Hello <b>Bob</b>');
    const got = await incoming;
    expect(got.message.id).toBe(sent.body.message.id);

    // Idempotent retry with the same clientId returns the same message, no duplicate.
    const again = await api.post(`/api/conversations/${convId}/messages`).set(auth(alice)).send({ body: 'Hello', clientId: 'client-msg-0001' });
    expect(again.status).toBe(200);
    expect(again.body.message.id).toBe(sent.body.message.id);

    const delivered = next(aliceSock, 'receipt');
    bobSock.emit('delivered', { conversationId: convId, messageId: got.message.id });
    const d = await delivered;
    expect(d.lastDeliveredId).toBe(got.message.id);
    expect(d.userId).toBe(bob.user.id);

    const typing = next(aliceSock, 'typing');
    bobSock.emit('typing', { conversationId: convId, typing: true });
    expect((await typing).typing).toBe(true);

    const list = await api.get('/api/conversations').set(auth(bob));
    expect(list.body.conversations[0].unreadCount).toBe(1);

    const readReceipt = next(aliceSock, 'receipt');
    const read = await api.post(`/api/conversations/${convId}/read`).set(auth(bob)).send({});
    expect(read.status).toBe(200);
    expect((await readReceipt).lastReadId).toBe(got.message.id);
    const list2 = await api.get('/api/conversations').set(auth(bob));
    expect(list2.body.conversations[0].unreadCount).toBe(0);

    // Presence: bob going offline is announced to alice with a last-seen time.
    const presence = next(aliceSock, 'presence');
    bobSock.disconnect();
    const p = await presence;
    expect(p).toMatchObject({ userId: bob.user.id, online: false });
    expect(p.lastSeenAt).toBeTruthy();
    aliceSock.disconnect();
  });

  it('keeps strangers out of a conversation', async () => {
    expect((await api.get(`/api/conversations/${convId}/messages`).set(auth(eve))).status).toBe(404);
    expect((await api.post(`/api/conversations/${convId}/messages`).set(auth(eve)).send({ body: 'hi' })).status).toBe(404);
    const msgs = await api.get(`/api/conversations/${convId}/messages`).set(auth(alice));
    const id = msgs.body.messages[0].id;
    expect((await api.delete(`/api/messages/${id}`).set(auth(eve))).status).toBe(404);
    expect((await api.put(`/api/messages/${id}/reaction`).set(auth(eve)).send({ emoji: '👍' })).status).toBe(404);
    // Bob can react but cannot delete Alice's message.
    expect((await api.delete(`/api/messages/${id}`).set(auth(bob))).status).toBe(404);
    const reacted = await api.put(`/api/messages/${id}/reaction`).set(auth(bob)).send({ emoji: '❤️' });
    expect(reacted.body.message.reactions).toEqual([{ userId: bob.user.id, emoji: '❤️' }]);
    expect((await api.put(`/api/messages/${id}/reaction`).set(auth(bob)).send({ emoji: 'abc' })).status).toBe(400);
  });

  it('sends a photo: re-encoded, metadata stripped, served via signed link', async () => {
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#2b6' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-gps' } } })
      .jpeg()
      .toBuffer();
    const r = await api
      .post(`/api/conversations/${convId}/media`)
      .set(auth(alice))
      .field('kind', 'image')
      .field('caption', 'Look at this')
      .field('clientId', 'client-img-0001')
      .attach('file', png, 'photo.jpg');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const media = r.body.message.media;
    expect(media).toMatchObject({ mime: 'image/webp', width: 900, height: 600 });
    expect(media.path).toBeUndefined();
    expect(media.preview).toMatch(/^data:image\/webp;base64,/);

    const url = new URL(media.url);
    const file = await api.get(url.pathname + url.search);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/webp');
    const meta = await sharp(file.body as Buffer).metadata();
    expect(meta.exif).toBeUndefined();

    // Tampered or unsigned links are refused.
    expect((await api.get(url.pathname + '?e=9999999999&s=forged')).status).toBe(403);
    expect((await api.get(url.pathname)).status).toBe(403);
  });

  it('rejects files that are not what they claim', async () => {
    const r = await api
      .post(`/api/conversations/${convId}/media`)
      .set(auth(alice))
      .field('kind', 'image')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
    expect(r.status).toBe(400);
  });

  it('sends a voice note: transcoded to MP3 with server-measured duration and waveform', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'hc-voice-test-'));
    const webm = path.join(dir, 'v.webm');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2.5', '-c:a', 'libopus', webm]);
    const r = await api
      .post(`/api/conversations/${convId}/media`)
      .set(auth(bob))
      .field('kind', 'voice')
      .field('clientId', 'client-voice-001')
      .attach('file', readFileSync(webm), { filename: 'upload.webm', contentType: 'audio/webm' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const media = r.body.message.media;
    expect(media.mime).toBe('audio/mpeg');
    expect(media.durationMs).toBeGreaterThan(2300);
    expect(media.durationMs).toBeLessThan(2800);
    expect(media.waveform).toHaveLength(48);
  });

  it('edits within the window and deletes for everyone', async () => {
    const s = await api.post(`/api/conversations/${convId}/messages`).set(auth(alice)).send({ body: 'tpyo' });
    const id = s.body.message.id;
    const e = await api.patch(`/api/messages/${id}`).set(auth(alice)).send({ body: 'typo' });
    expect(e.body.message.body).toBe('typo');
    expect(e.body.message.editedAt).toBeTruthy();
    expect((await api.patch(`/api/messages/${id}`).set(auth(bob)).send({ body: 'hacked' })).status).toBe(404);

    const d = await api.delete(`/api/messages/${id}`).set(auth(alice));
    expect(d.body.message.deletedAt).toBeTruthy();
    expect(d.body.message.body).toBeNull();
  });

  it('paginates history', async () => {
    for (let i = 0; i < 5; i++) await api.post(`/api/conversations/${convId}/messages`).set(auth(bob)).send({ body: `n${i}` });
    const page1 = await api.get(`/api/conversations/${convId}/messages?limit=3`).set(auth(alice));
    expect(page1.body.messages.map((m: any) => m.body)).toEqual(['n2', 'n3', 'n4']);
    expect(page1.body.hasMore).toBe(true);
    const page2 = await api.get(`/api/conversations/${convId}/messages?limit=3&before=${page1.body.messages[0].id}`).set(auth(alice));
    expect(page2.body.messages.at(-1).body).toBe('n1');
  });

  it('blocking stops messages both ways until unblocked', async () => {
    expect((await api.post(`/api/users/${bob.user.id}/block`).set(auth(alice))).status).toBe(200);
    const fromBob = await api.post(`/api/conversations/${convId}/messages`).set(auth(bob)).send({ body: 'hey?' });
    expect(fromBob.status).toBe(403);
    const fromAlice = await api.post(`/api/conversations/${convId}/messages`).set(auth(alice)).send({ body: 'hey?' });
    expect(fromAlice.status).toBe(403);
    const conv = await api.get(`/api/conversations/${convId}`).set(auth(alice));
    expect(conv.body.conversation.blockedByMe).toBe(true);
    await api.delete(`/api/users/${bob.user.id}/block`).set(auth(alice));
    expect((await api.post(`/api/conversations/${convId}/messages`).set(auth(bob)).send({ body: 'ok now' })).status).toBe(201);
  });

  it('clear chat hides history only for the person who cleared it', async () => {
    await api.post(`/api/conversations/${convId}/clear`).set(auth(alice));
    expect((await api.get(`/api/conversations/${convId}/messages`).set(auth(alice))).body.messages).toHaveLength(0);
    expect((await api.get(`/api/conversations/${convId}/messages`).set(auth(bob))).body.messages.length).toBeGreaterThan(0);
  });

  it('updates profile and avatar', async () => {
    const p = await api.patch('/api/users/me').set(auth(bob)).send({ displayName: 'Robert', bio: 'Builds things' });
    expect(p.body.user).toMatchObject({ displayName: 'Robert', bio: 'Builds things' });
    const img = await sharp({ create: { width: 500, height: 400, channels: 3, background: '#f2a93b' } }).png().toBuffer();
    const a = await api.post('/api/users/me/avatar').set(auth(bob)).attach('file', img, 'a.png');
    expect(a.status).toBe(200);
    expect(a.body.user.avatarUrl).toContain('/media/u/');
  });

  it('rejects sockets without a valid token or from unknown origins', async () => {
    await expect(connect({ ...alice, accessToken: 'bad' })).rejects.toThrow('unauthorized');
    await expect(
      new Promise((resolve, reject) => {
        const s = ioc(base, { auth: { token: alice.accessToken }, transports: ['websocket'], extraHeaders: { Origin: 'https://evil.example' } });
        s.on('connect', () => resolve(s));
        s.on('connect_error', (e) => reject(e));
      }),
    ).rejects.toThrow();
  });

  it('deletes an account with its chats', async () => {
    const wrong = await api.post('/api/users/me/delete').set(auth(eve)).send({ password: 'nope' });
    expect(wrong.status).toBe(400);
    const ok = await api.post('/api/users/me/delete').set(auth(eve)).send({ password: 'secret123' });
    expect(ok.status).toBe(204);
    expect((await api.post('/api/auth/login').send({ username: 'eve_3', password: 'secret123' })).status).toBe(401);
  });
});

describe('http hardening', () => {
  it('sets security headers and CORS only for allowed origins', async () => {
    const r = await api.get('/api/auth/me').set('Origin', ORIGIN);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toBeTruthy();
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
    const evil = await api.get('/api/auth/me').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects oversized JSON and unknown routes', async () => {
    const big = await api.post('/api/auth/login').send({ username: 'a', password: 'x'.repeat(40_000) });
    expect(big.status).toBe(413);
    expect((await api.get('/api/nope')).status).toBe(404);
  });

  it('health reports ok', async () => {
    const r = await api.get('/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });
});
