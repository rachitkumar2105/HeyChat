import { create } from 'zustand';
import type { Conversation, LocalMessage, Message, Receipt, User } from './types';

export type Connection = 'connecting' | 'online' | 'offline';

interface Thread {
  items: LocalMessage[];
  hasMore: boolean;
  loaded: boolean;
  loadingOlder: boolean;
}

interface State {
  me: User | null;
  authReady: boolean;
  conversations: Record<string, Conversation>;
  threads: Record<string, Thread>;
  typing: Record<string, number>;
  connection: Connection;
  activeId: string | null;
  notify: boolean;
}

const emptyThread: Thread = { items: [], hasMore: true, loaded: false, loadingOlder: false };

export const useStore = create<State>(() => ({
  me: null,
  authReady: false,
  conversations: {},
  threads: {},
  typing: {},
  connection: 'connecting',
  activeId: null,
  notify: readNotifyPref(),
}));

function readNotifyPref() {
  try {
    return localStorage.getItem('heychat.notify') === '1';
  } catch {
    return false;
  }
}

const set = useStore.setState;
const get = useStore.getState;

export const thread = (id: string): Thread => get().threads[id] ?? emptyThread;

function sortItems(items: LocalMessage[]) {
  // Server messages by id; optimistic ones (id < 0) stay at the end in creation order.
  return items.sort((a, b) => {
    if (a.id > 0 && b.id > 0) return a.id - b.id;
    if (a.id > 0) return -1;
    if (b.id > 0) return 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export const actions = {
  reset() {
    set({ me: null, conversations: {}, threads: {}, typing: {}, activeId: null, connection: 'connecting' });
  },

  setMe(me: User | null) {
    set({ me, authReady: true });
  },

  setNotify(on: boolean) {
    try {
      localStorage.setItem('heychat.notify', on ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ notify: on });
  },

  setConversations(list: Conversation[]) {
    const conversations: Record<string, Conversation> = {};
    const prev = get().conversations;
    for (const c of list) conversations[c.id] = c;
    // Keep chats opened locally that have no messages yet.
    for (const c of Object.values(prev)) if (!conversations[c.id] && !c.lastMessage) conversations[c.id] = c;
    set({ conversations });
  },

  upsertConversation(c: Conversation) {
    set((s) => ({ conversations: { ...s.conversations, [c.id]: c } }));
  },

  patchConversation(id: string, patch: Partial<Conversation>) {
    set((s) => (s.conversations[id] ? { conversations: { ...s.conversations, [id]: { ...s.conversations[id]!, ...patch } } } : s));
  },

  removeConversationsWith(userId: string) {
    set((s) => {
      const conversations = { ...s.conversations };
      for (const [id, c] of Object.entries(conversations)) if (c.peer.id === userId) delete conversations[id];
      return { conversations };
    });
  },

  setThread(id: string, patch: Partial<Thread>) {
    set((s) => ({ threads: { ...s.threads, [id]: { ...(s.threads[id] ?? emptyThread), ...patch } } }));
  },

  /** Merge server messages into a thread (dedupes by id and by clientId for optimistic ones). */
  mergeMessages(convId: string, incoming: Message[], opts: { older?: boolean; hasMore?: boolean } = {}) {
    set((s) => {
      const t = s.threads[convId] ?? emptyThread;
      const byId = new Map<number, LocalMessage>();
      const pendingByClient = new Map<string, LocalMessage>();
      for (const m of t.items) {
        if (m.id > 0) byId.set(m.id, m);
        else if (m.clientId) pendingByClient.set(m.clientId, m);
      }
      for (const m of incoming) {
        byId.set(m.id, m);
        if (m.clientId) pendingByClient.delete(m.clientId);
      }
      const items = sortItems([...byId.values(), ...pendingByClient.values()]);
      return {
        threads: {
          ...s.threads,
          [convId]: {
            ...t,
            items,
            loaded: true,
            hasMore: opts.hasMore ?? t.hasMore,
            loadingOlder: opts.older ? false : t.loadingOlder,
          },
        },
      };
    });
  },

  addPending(convId: string, m: LocalMessage) {
    set((s) => {
      const t = s.threads[convId] ?? { ...emptyThread, loaded: true };
      return { threads: { ...s.threads, [convId]: { ...t, items: [...t.items, m] } } };
    });
  },

  patchPending(convId: string, clientId: string, patch: Partial<LocalMessage>) {
    set((s) => {
      const t = s.threads[convId];
      if (!t) return s;
      return {
        threads: {
          ...s.threads,
          [convId]: { ...t, items: t.items.map((m) => (m.id < 0 && m.clientId === clientId ? { ...m, ...patch } : m)) },
        },
      };
    });
  },

  removePending(convId: string, clientId: string) {
    set((s) => {
      const t = s.threads[convId];
      if (!t) return s;
      return { threads: { ...s.threads, [convId]: { ...t, items: t.items.filter((m) => !(m.id < 0 && m.clientId === clientId)) } } };
    });
  },

  /** A new message arrived (socket or own REST response). Updates thread + chat list. */
  receiveMessage(m: Message, opts: { isNew: boolean }) {
    actions.mergeMessages(m.conversationId, [m]);
    const s = get();
    const c = s.conversations[m.conversationId];
    if (!c) return false;
    const fromPeer = m.senderId !== s.me?.id;
    const patch: Partial<Conversation> = {};
    if (!c.lastMessage || m.id >= c.lastMessage.id) {
      patch.lastMessage = m;
      patch.lastMessageAt = m.createdAt;
    }
    if (opts.isNew && fromPeer && m.id > c.myLastReadId) patch.unreadCount = c.unreadCount + 1;
    if (!fromPeer) patch.myLastReadId = Math.max(c.myLastReadId, m.id);
    actions.patchConversation(c.id, patch);
    if (fromPeer) actions.setTyping(c.id, false);
    return true;
  },

  updateMessage(m: Message) {
    const t = get().threads[m.conversationId];
    if (t) actions.mergeMessages(m.conversationId, [m]);
    const c = get().conversations[m.conversationId];
    if (c?.lastMessage?.id === m.id) actions.patchConversation(c.id, { lastMessage: m });
  },

  applyReceipt(r: Receipt) {
    const s = get();
    const c = s.conversations[r.conversationId];
    if (!c) return;
    if (r.userId === s.me?.id) {
      const lastId = c.lastMessage?.id ?? 0;
      actions.patchConversation(c.id, {
        myLastReadId: Math.max(c.myLastReadId, r.lastReadId),
        unreadCount: r.lastReadId >= lastId ? 0 : c.unreadCount,
      });
    } else {
      actions.patchConversation(c.id, {
        peerLastReadId: Math.max(c.peerLastReadId, r.lastReadId),
        peerLastDeliveredId: Math.max(c.peerLastDeliveredId, r.lastDeliveredId),
      });
    }
  },

  updateUser(u: User) {
    const s = get();
    if (s.me?.id === u.id) set({ me: { ...s.me, ...u } });
    for (const c of Object.values(s.conversations)) {
      if (c.peer.id === u.id) actions.patchConversation(c.id, { peer: { ...c.peer, ...u } });
    }
  },

  setPresence(userId: string, online: boolean, lastSeenAt: string | null) {
    for (const c of Object.values(get().conversations)) {
      if (c.peer.id === userId) {
        actions.patchConversation(c.id, { peer: { ...c.peer, online, lastSeenAt: lastSeenAt ?? c.peer.lastSeenAt } });
      }
    }
  },

  setTyping(convId: string, typing: boolean) {
    set((s) => {
      const next = { ...s.typing };
      if (typing) next[convId] = Date.now() + 6000;
      else delete next[convId];
      return { typing: next };
    });
  },

  setActive(id: string | null) {
    set({ activeId: id });
  },

  setConnection(connection: Connection) {
    set({ connection });
  },
};

export function totalUnread(conversations: Record<string, Conversation>) {
  return Object.values(conversations).reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0);
}
