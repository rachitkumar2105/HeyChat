import type { Logger } from 'pino';
import type { Config } from './config.js';
import type { Db } from './lib/db.js';
import type { Storage } from './lib/storage.js';
import { MediaSigner } from './media/signing.js';
import type { ConversationRow, MessageRow, UserRow } from './types.js';

/** Tracks who is online and fans events out to every socket a user has open. */
export class Hub {
  private readonly online = new Map<string, number>();
  private emitter: ((room: string, event: string, payload: unknown) => void) | null = null;
  private kicker: ((room: string) => void) | null = null;

  attach(emitter: (room: string, event: string, payload: unknown) => void, kicker: (room: string) => void) {
    this.emitter = emitter;
    this.kicker = kicker;
  }

  /** Drop every live socket of a user; clients reconnect and must re-authenticate. */
  kick(userId: string) {
    this.kicker?.(`u:${userId}`);
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.emitter?.(`u:${userId}`, event, payload);
  }

  connect(userId: string): boolean {
    const n = (this.online.get(userId) ?? 0) + 1;
    this.online.set(userId, n);
    return n === 1;
  }

  disconnect(userId: string): boolean {
    const n = (this.online.get(userId) ?? 1) - 1;
    if (n <= 0) {
      this.online.delete(userId);
      return true;
    }
    this.online.set(userId, n);
    return false;
  }

  isOnline(userId: string) {
    return this.online.has(userId);
  }

  get onlineCount() {
    return this.online.size;
  }
}

export interface AppContext {
  config: Config;
  db: Db;
  storage: Storage;
  signer: MediaSigner;
  hub: Hub;
  log: Logger;
  /** userId -> token version, cached briefly so revoked access tokens die within a minute. */
  tokenVersions: Map<string, { tv: number; at: number }>;
}

export function createContext(config: Config, db: Db, storage: Storage, log: Logger): AppContext {
  return {
    config,
    db,
    storage,
    log,
    signer: new MediaSigner(config.keys.media, config.publicUrl),
    hub: new Hub(),
    tokenVersions: new Map(),
  };
}

// ---------------------------------------------------------------------------
// Presenters: DB rows -> API shapes. Storage paths never leave the server; clients
// get signed URLs instead.
// ---------------------------------------------------------------------------

export function presentUser(ctx: AppContext, u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: u.avatarPath ? ctx.signer.url(u.avatarPath) : null,
    lastSeenAt: u.lastSeenAt,
    online: ctx.hub.isOnline(u.id),
    createdAt: u.createdAt,
  };
}

export function presentMessage(ctx: AppContext, m: MessageRow) {
  let media: Record<string, unknown> | null = null;
  if (m.media) {
    const { path, ...rest } = m.media as unknown as Record<string, unknown> & { path: string };
    media = { ...rest, url: ctx.signer.url(path) };
  }
  return { ...m, media };
}

export function presentConversation(ctx: AppContext, c: ConversationRow) {
  return {
    ...c,
    peer: presentUser(ctx, c.peer),
    lastMessage: c.lastMessage ? presentMessage(ctx, c.lastMessage) : null,
  };
}

export type PublicUser = ReturnType<typeof presentUser>;
export type PublicMessage = ReturnType<typeof presentMessage>;
