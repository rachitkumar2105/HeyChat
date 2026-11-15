import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { isOriginAllowed } from '../config.js';
import type { AppContext } from '../context.js';
import { authenticate } from '../lib/http.js';
import type { ConversationRow, Receipt } from '../types.js';

const TypingEvent = z.object({ conversationId: z.uuid(), typing: z.boolean() });
const DeliveredEvent = z.object({ conversationId: z.uuid(), messageId: z.number().int().positive() });
const AuthEvent = z.object({ token: z.string().max(2000) });

export function attachRealtime(ctx: AppContext, http: HttpServer) {
  const { db, hub, log } = ctx;

  const io = new Server(http, {
    path: '/socket.io',
    cors: {
      origin: (origin, cb) => cb(null, isOriginAllowed(ctx.config, origin)),
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 20_000,
    pingTimeout: 25_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000, skipMiddlewares: false },
  });

  hub.attach(
    (room, event, payload) => io.to(room).emit(event, payload),
    (room) => io.in(room).disconnectSockets(true),
  );

  /** conversationId -> peer user id for a given user, cached; direct-chat membership never changes. */
  const peerCache = new Map<string, string>();
  async function peerOf(userId: string, conversationId: string): Promise<string | null> {
    const k = `${userId}:${conversationId}`;
    const hit = peerCache.get(k);
    if (hit) return hit;
    try {
      const conv = await db.call<ConversationRow>('hc_get_conversation', { p_user: userId, p_conv: conversationId });
      peerCache.set(k, conv.peer.id);
      if (peerCache.size > 50_000) peerCache.clear();
      return conv.peer.id;
    } catch {
      return null;
    }
  }

  const partnerCache = new Map<string, { ids: string[]; at: number }>();
  async function partnersOf(userId: string): Promise<string[]> {
    const hit = partnerCache.get(userId);
    if (hit && Date.now() - hit.at < 60_000) return hit.ids;
    const ids = await db.call<string[]>('hc_partner_ids', { p_user: userId });
    partnerCache.set(userId, { ids, at: Date.now() });
    return ids;
  }

  async function announce(userId: string, online: boolean, lastSeenAt: string | null) {
    try {
      const partners = await partnersOf(userId);
      for (const p of partners) hub.toUser(p, 'presence', { userId, online, lastSeenAt });
    } catch (err) {
      log.warn({ err }, 'presence broadcast failed');
    }
  }

  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (!isOriginAllowed(ctx.config, origin)) return next(Object.assign(new Error('origin_not_allowed'), { code: 'origin_not_allowed' }));
      const token = String((socket.handshake.auth as { token?: unknown })?.token ?? '');
      const claims = await authenticate(ctx, token);
      socket.data.userId = claims.sub;
      socket.data.exp = claims.exp;
      next();
    } catch (e) {
      const code = (e as { code?: string }).code;
      next(new Error(code === 'origin_not_allowed' ? code : 'unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`u:${userId}`);

    if (hub.connect(userId)) void announce(userId, true, null);

    // Everything sent while this user was offline is now delivered.
    void db
      .call<Receipt[]>('hc_mark_all_delivered', { p_user: userId })
      .then((receipts) => {
        for (const r of receipts) hub.toUser(r.peerId, 'receipt', r);
      })
      .catch((err) => log.warn({ err }, 'mark_all_delivered failed'));

    // Small per-socket token bucket so a misbehaving client cannot flood the server.
    let tokens = 30;
    const refill = setInterval(() => (tokens = Math.min(30, tokens + 10)), 1000);
    const allow = () => {
      if (Date.now() / 1000 > (socket.data.exp as number)) {
        // Client reconnects automatically and its auth callback supplies a fresh token.
        socket.disconnect(true);
        return false;
      }
      return tokens-- > 0;
    };

    socket.on('auth', async (raw: unknown, ack?: (r: { ok: boolean }) => void) => {
      const p = AuthEvent.safeParse(raw);
      if (!p.success) return ack?.({ ok: false });
      try {
        const claims = await authenticate(ctx, p.data.token);
        if (claims.sub !== userId) return ack?.({ ok: false });
        socket.data.exp = claims.exp;
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('typing', async (raw: unknown) => {
      if (!allow()) return;
      const p = TypingEvent.safeParse(raw);
      if (!p.success) return;
      const peer = await peerOf(userId, p.data.conversationId);
      if (peer) hub.toUser(peer, 'typing', { conversationId: p.data.conversationId, userId, typing: p.data.typing });
    });

    socket.on('delivered', async (raw: unknown) => {
      if (!allow()) return;
      const p = DeliveredEvent.safeParse(raw);
      if (!p.success) return;
      try {
        const r = await db.call<Receipt>('hc_mark_delivered', {
          p_user: userId,
          p_conv: p.data.conversationId,
          p_upto: p.data.messageId,
        });
        hub.toUser(r.peerId, 'receipt', r);
      } catch {
        /* not a member: ignore */
      }
    });

    socket.on('disconnect', async () => {
      clearInterval(refill);
      if (hub.disconnect(userId)) {
        try {
          const at = await db.call<string>('hc_set_last_seen', { p_user: userId });
          if (hub.isOnline(userId)) return; // reconnected while we were writing
          await announce(userId, false, at ? new Date(at).toISOString() : new Date().toISOString());
        } catch (err) {
          log.warn({ err }, 'last seen update failed');
        }
      }
    });
  });

  return io;
}
