import { io, type Socket } from 'socket.io-client';
import { API_URL, ApiError, api, getAccessToken, refreshSession, uploadForm } from './api';
import { actions, thread, useStore } from './store';
import type { Conversation, LocalMessage, Message, Receipt, User } from './types';
import { previewText } from './format';

let socket: Socket | null = null;
let pendingConvFetch = new Set<string>();

export function getSocket() {
  return socket;
}

export function startSync() {
  stopSync();
  actions.setConnection('connecting');
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      getAccessToken().then((token) => cb({ token }));
    },
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
  });

  socket.on('connect', () => {
    actions.setConnection('online');
    void loadConversations();
    const active = useStore.getState().activeId;
    if (active) void loadLatest(active);
  });
  socket.on('disconnect', (reason) => {
    actions.setConnection('offline');
    // Server-side disconnects (token expiry, password change) are not retried automatically.
    if (reason === 'io server disconnect') setTimeout(() => socket?.connect(), 500);
  });
  socket.on('connect_error', async (err) => {
    actions.setConnection('offline');
    if (err.message === 'unauthorized') {
      const ok = await refreshSession();
      if (ok) setTimeout(() => socket?.connect(), 300);
    }
  });

  socket.on('message:new', async ({ message }: { message: Message }) => {
    const me = useStore.getState().me;
    const known = actions.receiveMessage(message, { isNew: true });
    if (!known) await fetchConversation(message.conversationId);
    if (message.senderId !== me?.id) {
      socket?.emit('delivered', { conversationId: message.conversationId, messageId: message.id });
      maybeMarkRead(message.conversationId);
      notifyIncoming(message);
    }
  });
  socket.on('message:updated', ({ message }: { message: Message }) => actions.updateMessage(message));
  socket.on('receipt', (r: Receipt) => actions.applyReceipt(r));
  socket.on('typing', ({ conversationId, typing }: { conversationId: string; typing: boolean }) =>
    actions.setTyping(conversationId, typing),
  );
  socket.on('presence', ({ userId, online, lastSeenAt }: { userId: string; online: boolean; lastSeenAt: string | null }) =>
    actions.setPresence(userId, online, lastSeenAt),
  );
  socket.on('user:updated', ({ user }: { user: User }) => actions.updateUser(user));
  socket.on('user:deleted', ({ userId }: { userId: string }) => actions.removeConversationsWith(userId));
}

export function stopSync() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  pendingConvFetch = new Set();
}

async function fetchConversation(id: string) {
  if (pendingConvFetch.has(id)) return;
  pendingConvFetch.add(id);
  try {
    const { conversation } = await api<{ conversation: Conversation }>(`/conversations/${id}`);
    actions.upsertConversation(conversation);
  } catch {
    /* ignore */
  } finally {
    pendingConvFetch.delete(id);
  }
}

export async function loadConversations() {
  const { conversations } = await api<{ conversations: Conversation[] }>('/conversations');
  actions.setConversations(conversations);
}

export async function loadLatest(convId: string) {
  const res = await api<{ messages: Message[]; hasMore: boolean }>(`/conversations/${convId}/messages?limit=40`);
  const t = thread(convId);
  actions.mergeMessages(convId, res.messages, { hasMore: t.loaded ? t.hasMore : res.hasMore });
}

export async function loadOlder(convId: string) {
  const t = thread(convId);
  if (t.loadingOlder || !t.hasMore) return;
  const oldest = t.items.find((m) => m.id > 0);
  if (!oldest) return;
  actions.setThread(convId, { loadingOlder: true });
  try {
    const res = await api<{ messages: Message[]; hasMore: boolean }>(
      `/conversations/${convId}/messages?limit=40&before=${oldest.id}`,
    );
    actions.mergeMessages(convId, res.messages, { older: true, hasMore: res.hasMore });
  } catch {
    actions.setThread(convId, { loadingOlder: false });
  }
}

// ---------------------------------------------------------------------------
// Read receipts: mark read when the chat is open and the tab is visible.
// ---------------------------------------------------------------------------
const readTimers = new Map<string, number>();
export function maybeMarkRead(convId: string) {
  const s = useStore.getState();
  if (s.activeId !== convId || document.visibilityState !== 'visible') return;
  const c = s.conversations[convId];
  if (!c || !c.lastMessage || c.lastMessage.id <= c.myLastReadId || c.lastMessage.senderId === s.me?.id) return;
  window.clearTimeout(readTimers.get(convId));
  readTimers.set(
    convId,
    window.setTimeout(() => {
      actions.patchConversation(convId, { unreadCount: 0, myLastReadId: c.lastMessage!.id });
      api<{ receipt: Receipt }>(`/conversations/${convId}/read`, { method: 'POST', body: {} })
        .then(({ receipt }) => actions.applyReceipt(receipt))
        .catch(() => undefined);
    }, 250),
  );
}

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------
let lastTypingSent = 0;
let typingStopTimer = 0;
export function sendTyping(conv: Conversation, typing: boolean) {
  if (!socket?.connected) return;
  const now = Date.now();
  window.clearTimeout(typingStopTimer);
  if (typing) {
    if (now - lastTypingSent > 2500) {
      lastTypingSent = now;
      socket.emit('typing', { conversationId: conv.id, peerId: conv.peer.id, typing: true });
    }
    typingStopTimer = window.setTimeout(() => sendTyping(conv, false), 3500);
  } else {
    lastTypingSent = 0;
    socket.emit('typing', { conversationId: conv.id, peerId: conv.peer.id, typing: false });
  }
}

// ---------------------------------------------------------------------------
// Sending (optimistic)
// ---------------------------------------------------------------------------
let tempSeq = 0;
const newClientId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

function optimistic(convId: string, partial: Partial<LocalMessage>): LocalMessage {
  const me = useStore.getState().me!;
  return {
    id: -++tempSeq,
    conversationId: convId,
    senderId: me.id,
    clientId: newClientId(),
    kind: 'text',
    body: null,
    media: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    replyTo: null,
    reactions: [],
    pending: true,
    ...partial,
  };
}

function replyStub(reply: Message | null): LocalMessage['replyTo'] {
  return reply ? { id: reply.id, senderId: reply.senderId, kind: reply.kind, body: reply.body, deleted: false } : null;
}

export async function sendText(convId: string, body: string, reply: Message | null) {
  const m = optimistic(convId, { kind: 'text', body, replyTo: replyStub(reply) });
  actions.addPending(convId, m);
  await deliverText(convId, m);
}

async function deliverText(convId: string, m: LocalMessage) {
  try {
    const { message } = await api<{ message: Message }>(`/conversations/${convId}/messages`, {
      method: 'POST',
      body: { body: m.body, clientId: m.clientId, replyToId: m.replyTo?.id ?? null },
    });
    actions.receiveMessage(message, { isNew: false });
  } catch (err) {
    actions.patchPending(convId, m.clientId!, { failed: (err as Error).message });
  }
}

export async function sendMedia(
  convId: string,
  kind: 'image' | 'voice',
  file: Blob,
  extra: { caption?: string; reply: Message | null; durationMs?: number; waveform?: number[]; width?: number; height?: number },
) {
  const localUrl = URL.createObjectURL(file);
  const m = optimistic(convId, {
    kind,
    body: extra.caption || null,
    replyTo: replyStub(extra.reply),
    media: {
      url: localUrl,
      mime: file.type,
      size: file.size,
      durationMs: extra.durationMs,
      waveform: extra.waveform,
      width: extra.width,
      height: extra.height,
    },
    localFile: file,
    progress: 0,
  });
  actions.addPending(convId, m);
  await deliverMedia(convId, m);
}

async function deliverMedia(convId: string, m: LocalMessage) {
  const form = new FormData();
  form.append('kind', m.kind);
  if (m.body) form.append('caption', m.body);
  if (m.replyTo) form.append('replyToId', String(m.replyTo.id));
  form.append('clientId', m.clientId!);
  const ext = m.localFile!.type.includes('mp4') ? 'm4a' : m.localFile!.type.includes('ogg') ? 'ogg' : m.kind === 'voice' ? 'webm' : 'img';
  form.append('file', m.localFile!, `upload.${ext}`);
  try {
    const { message } = await uploadForm<{ message: Message }>(`/conversations/${convId}/media`, form, (p) =>
      actions.patchPending(convId, m.clientId!, { progress: p }),
    );
    actions.receiveMessage(message, { isNew: false });
  } catch (err) {
    actions.patchPending(convId, m.clientId!, { failed: (err as Error).message, progress: undefined });
  }
}

export async function retry(m: LocalMessage) {
  actions.patchPending(m.conversationId, m.clientId!, { failed: undefined, progress: m.localFile ? 0 : undefined });
  if (m.localFile) await deliverMedia(m.conversationId, m);
  else await deliverText(m.conversationId, m);
}

export function discard(m: LocalMessage) {
  if (m.media?.url.startsWith('blob:')) URL.revokeObjectURL(m.media.url);
  actions.removePending(m.conversationId, m.clientId!);
}

export async function editMessage(m: Message, body: string) {
  const { message } = await api<{ message: Message }>(`/messages/${m.id}`, { method: 'PATCH', body: { body } });
  actions.updateMessage(message);
}

export async function deleteMessage(m: Message) {
  const { message } = await api<{ message: Message }>(`/messages/${m.id}`, { method: 'DELETE' });
  actions.updateMessage(message);
}

export async function react(m: Message, emoji: string | null) {
  const { message } = await api<{ message: Message }>(`/messages/${m.id}/reaction`, { method: 'PUT', body: { emoji } });
  actions.updateMessage(message);
}

export async function openChatWith(userId: string): Promise<Conversation> {
  const { conversation } = await api<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { userId } });
  actions.upsertConversation(conversation);
  return conversation;
}

// ---------------------------------------------------------------------------
// Browser notifications (opt-in from settings)
// ---------------------------------------------------------------------------
function notifyIncoming(m: Message) {
  const s = useStore.getState();
  if (!s.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && s.activeId === m.conversationId) return;
  const c = s.conversations[m.conversationId];
  if (!c) return;
  try {
    const n = new Notification(c.peer.displayName, {
      body: previewText(m),
      tag: m.conversationId,
      icon: c.peer.avatarUrl ?? '/icon-192.png',
    });
    n.onclick = () => {
      window.focus();
      window.location.assign(`/chat/${m.conversationId}`);
    };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
