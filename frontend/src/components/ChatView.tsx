import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { dayLabel, isSameDay, lastSeen } from '../lib/format';
import { actions, thread, useStore } from '../lib/store';
import { deleteMessage, loadLatest, loadOlder, maybeMarkRead, react } from '../lib/sync';
import type { Conversation, LocalMessage, Message } from '../lib/types';
import { Composer } from './Composer';
import { IconArrowDown, IconBack, IconBlock, IconBroom, IconCopy, IconEdit, IconMore, IconReply, IconTrash } from './Icons';
import { MessageBubble, type Status } from './MessageBubble';
import { Avatar, Dialog, Spinner, toast } from './ui';

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EDIT_WINDOW = 15 * 60 * 1000;

export function ChatView({ conv }: { conv: Conversation }) {
  const me = useStore((s) => s.me)!;
  const t = useStore((s) => s.threads[conv.id]);
  const typingUntil = useStore((s) => s.typing[conv.id] ?? 0);
  const connection = useStore((s) => s.connection);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menu, setMenu] = useState<{ m: LocalMessage; rect: DOMRect } | null>(null);
  const [viewer, setViewer] = useState<LocalMessage | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | 'clear' | 'block' | { del: Message }>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [flash, setFlash] = useState<number | null>(null);
  const [, force] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);
  const lastLen = useRef(0);
  const firstUnread = useRef<number | null>(null);
  const didInitialScroll = useRef(false);

  const items = t?.items ?? [];
  const loaded = t?.loaded ?? false;

  // Load on open; reset per-chat UI state.
  useEffect(() => {
    actions.setActive(conv.id);
    setReplyTo(null);
    setEditing(null);
    setMenu(null);
    setNewCount(0);
    didInitialScroll.current = false;
    firstUnread.current = conv.unreadCount > 0 ? conv.myLastReadId : null;
    loadLatest(conv.id).catch((e) => toast((e as Error).message, 'error'));
    return () => actions.setActive(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id]);

  useEffect(() => {
    maybeMarkRead(conv.id);
    const onVis = () => maybeMarkRead(conv.id);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [conv.id, conv.lastMessage?.id]);

  // Re-render periodically so "typing" and "last seen" labels expire.
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (typingUntil > Date.now()) {
      const id = window.setTimeout(() => force((n) => n + 1), typingUntil - Date.now() + 50);
      return () => window.clearTimeout(id);
    }
  }, [typingUntil]);

  // Scroll management.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !loaded) return;
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      const marker = el.querySelector('.unread-divider');
      if (marker) (marker as HTMLElement).scrollIntoView({ block: 'center' });
      else el.scrollTop = el.scrollHeight;
      lastLen.current = items.length;
      return;
    }
    if (prevHeight.current) {
      // Older page was prepended: keep the viewport anchored.
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = 0;
      lastLen.current = items.length;
      return;
    }
    if (items.length > lastLen.current) {
      const last = items[items.length - 1];
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (last && (last.senderId === me.id || nearBottom)) {
        el.scrollTo({ top: el.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      } else {
        setNewCount((n) => n + (items.length - lastLen.current));
      }
    }
    lastLen.current = items.length;
  }, [items, loaded, me.id]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(bottom);
    if (bottom) setNewCount(0);
    if (el.scrollTop < 300 && t?.hasMore && !t.loadingOlder && loaded) {
      prevHeight.current = el.scrollHeight;
      void loadOlder(conv.id).then(() => {
        if (!thread(conv.id).loadingOlder && prevHeight.current && scroller.current?.scrollHeight === prevHeight.current) {
          prevHeight.current = 0;
        }
      });
    }
    if (menu) setMenu(null);
  };

  const toBottom = () => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
    setNewCount(0);
  };

  const jumpTo = useCallback(
    async (id: number) => {
      for (let i = 0; i < 6; i++) {
        const el = document.getElementById(`m-${id}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setFlash(id);
          window.setTimeout(() => setFlash(null), 1600);
          return;
        }
        if (!thread(conv.id).hasMore) break;
        prevHeight.current = scroller.current?.scrollHeight ?? 0;
        await loadOlder(conv.id);
      }
      toast('That message is no longer available.');
    },
    [conv.id],
  );

  const statusOf = useCallback(
    (m: LocalMessage): Status | null => {
      if (m.senderId !== me.id) return null;
      if (m.failed) return 'failed';
      if (m.pending || m.id < 0) return 'pending';
      if (m.id <= conv.peerLastReadId) return 'read';
      if (m.id <= conv.peerLastDeliveredId) return 'delivered';
      return 'sent';
    },
    [conv.peerLastReadId, conv.peerLastDeliveredId, me.id],
  );

  const onMenu = useCallback((m: LocalMessage, rect: DOMRect) => setMenu({ m, rect }), []);
  const onOpenImage = useCallback((m: LocalMessage) => setViewer(m), []);

  const typing = typingUntil > Date.now();
  const status = typing ? 'typing…' : conv.peer.online ? 'online' : lastSeen(conv.peer.lastSeenAt);

  const rows = useMemo(() => {
    const out: { m: LocalMessage; day: string | null; grouped: boolean; unreadMark: boolean }[] = [];
    let unreadPlaced = false;
    items.forEach((m, i) => {
      const prev = items[i - 1];
      const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
      const grouped =
        !!prev && !newDay && prev.senderId === m.senderId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 3 * 60_000;
      const unreadMark =
        !unreadPlaced && firstUnread.current !== null && m.id > firstUnread.current && m.senderId !== me.id && m.id > 0;
      if (unreadMark) unreadPlaced = true;
      out.push({ m, day: newDay ? dayLabel(m.createdAt) : null, grouped: grouped && !unreadMark, unreadMark });
    });
    return out;
  }, [items, me.id]);

  const doDelete = async (m: Message) => {
    try {
      await deleteMessage(m);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const toggleBlock = async () => {
    try {
      if (conv.blockedByMe) await api(`/users/${conv.peer.id}/block`, { method: 'DELETE' });
      else await api(`/users/${conv.peer.id}/block`, { method: 'POST' });
      actions.patchConversation(conv.id, { blockedByMe: !conv.blockedByMe });
      toast(conv.blockedByMe ? `Unblocked ${conv.peer.displayName}` : `Blocked ${conv.peer.displayName}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const clearChat = async () => {
    try {
      const { conversation } = await api<{ conversation: Conversation }>(`/conversations/${conv.id}/clear`, { method: 'POST' });
      actions.setThread(conv.id, { items: [], hasMore: false, loaded: true });
      actions.upsertConversation(conversation);
      toast('Chat cleared on this account');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <section className="chat" aria-label={`Chat with ${conv.peer.displayName}`}>
      <header className="chat-head">
        <Link to="/chat" className="icon-btn back-btn" aria-label="Back to chats" title="Back to chats">
          <IconBack />
        </Link>
        <button type="button" className="chat-peer" onClick={() => setProfileOpen(true)}>
          <Avatar user={conv.peer} size={40} online={conv.peer.online} />
          <span className="chat-peer-text">
            <strong>{conv.peer.displayName}</strong>
            <span className={typing ? 'is-typing' : ''}>{connection === 'online' ? status : 'connecting…'}</span>
          </span>
        </button>
        <div className="menu-anchor">
          <button
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={headerMenu}
            onClick={() => setHeaderMenu((v) => !v)}
            aria-label="Chat options"
            title="Chat options"
          >
            <IconMore />
          </button>
          {headerMenu ? (
            <PopMenu onClose={() => setHeaderMenu(false)} className="head-menu">
              <button type="button" role="menuitem" onClick={() => { setHeaderMenu(false); setConfirm('clear'); }}>
                <IconBroom size={18} /> Clear chat
              </button>
              <button type="button" role="menuitem" onClick={() => { setHeaderMenu(false); if (conv.blockedByMe) void toggleBlock(); else setConfirm('block'); }}>
                <IconBlock size={18} /> {conv.blockedByMe ? 'Unblock' : 'Block'} {conv.peer.displayName}
              </button>
            </PopMenu>
          ) : null}
        </div>
      </header>

      <div className="messages" ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
        {!loaded ? (
          <div className="messages-loading">
            <Spinner label="Loading messages" />
          </div>
        ) : (
          <>
            {t?.loadingOlder ? (
              <div className="older-loading">
                <Spinner label="Loading older messages" />
              </div>
            ) : !t?.hasMore ? (
              <p className="chat-start">
                This is the start of your chat with {conv.peer.displayName}. Only the two of you can see these messages.
              </p>
            ) : null}
            {rows.map(({ m, day, grouped, unreadMark }) => (
              <Fragment key={m.clientId && m.id < 0 ? m.clientId : m.id}>
                {day ? (
                  <div className="day">
                    <span>{day}</span>
                  </div>
                ) : null}
                {unreadMark ? (
                  <div className="unread-divider">
                    <span>Unread messages</span>
                  </div>
                ) : null}
                <MessageBubble
                  m={m}
                  mine={m.senderId === me.id}
                  status={statusOf(m)}
                  peerName={conv.peer.displayName}
                  myId={me.id}
                  grouped={grouped}
                  highlighted={flash === m.id}
                  onMenu={onMenu}
                  onOpenImage={onOpenImage}
                  onJumpTo={jumpTo}
                />
              </Fragment>
            ))}
            {typing ? (
              <div className="row row-peer">
                <div className="bubble bubble-peer typing-bubble" aria-label={`${conv.peer.displayName} is typing`}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {!atBottom ? (
        <button type="button" className="jump" onClick={toBottom} aria-label="Jump to latest message">
          {newCount > 0 ? <span className="jump-count">{newCount}</span> : null}
          <IconArrowDown size={20} />
        </button>
      ) : null}

      <Composer
        conv={conv}
        replyTo={replyTo}
        editing={editing}
        peerName={conv.peer.displayName}
        myId={me.id}
        onDone={() => {
          setReplyTo(null);
          setEditing(null);
        }}
      />

      {menu ? (
        <MessageMenu
          m={menu.m}
          rect={menu.rect}
          mine={menu.m.senderId === me.id}
          myReaction={menu.m.reactions.find((r) => r.userId === me.id)?.emoji ?? null}
          onClose={() => setMenu(null)}
          onReply={() => {
            setEditing(null);
            setReplyTo(menu.m);
          }}
          onEdit={() => {
            setReplyTo(null);
            setEditing(menu.m);
          }}
          onDelete={() => setConfirm({ del: menu.m })}
          onReact={(e) => react(menu.m, e).catch((err) => toast((err as Error).message, 'error'))}
        />
      ) : null}

      <Dialog open={Boolean(viewer)} onClose={() => setViewer(null)} title="Photo" className="viewer" hideTitle>
        {viewer?.media ? (
          <figure>
            <img src={viewer.media.url} alt={viewer.body ? `Photo: ${viewer.body}` : 'Photo'} />
            {viewer.body ? <figcaption>{viewer.body}</figcaption> : null}
            <a href={viewer.media.url} target="_blank" rel="noopener noreferrer" className="viewer-open">
              Open full size
            </a>
          </figure>
        ) : null}
      </Dialog>

      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} title="Contact info">
        <div className="profile-card">
          <Avatar user={conv.peer} size={96} />
          <h3>{conv.peer.displayName}</h3>
          <p className="muted">@{conv.peer.username}</p>
          <p className="muted">{conv.peer.online ? 'online' : lastSeen(conv.peer.lastSeenAt)}</p>
          {conv.peer.bio ? <p className="profile-bio">{conv.peer.bio}</p> : null}
        </div>
      </Dialog>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'clear' ? 'Clear this chat?' : confirm === 'block' ? `Block ${conv.peer.displayName}?` : 'Delete message?'}>
        <div className="confirm">
          <p>
            {confirm === 'clear'
              ? `Messages will be removed from your view only. ${conv.peer.displayName} keeps their copy.`
              : confirm === 'block'
                ? `${conv.peer.displayName} will not be able to message you, and you will not be able to message them until you unblock.`
                : 'This message will be deleted for both of you. This cannot be undone.'}
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c === 'clear') void clearChat();
                else if (c === 'block') void toggleBlock();
                else if (c && typeof c === 'object') void doDelete(c.del);
              }}
            >
              {confirm === 'clear' ? 'Clear chat' : confirm === 'block' ? 'Block' : 'Delete for everyone'}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function PopMenu({ children, onClose, className = '', style }: { children: React.ReactNode; onClose: () => void; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('button');
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const btns = Array.from(ref.current?.querySelectorAll<HTMLElement>('button') ?? []);
        const i = btns.indexOf(document.activeElement as HTMLElement);
        btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus();
        e.preventDefault();
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className={`pop-menu ${className}`} style={style}>
      {children}
    </div>
  );
}

function MessageMenu({
  m,
  rect,
  mine,
  myReaction,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  m: LocalMessage;
  rect: DOMRect;
  mine: boolean;
  myReaction: string | null;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string | null) => void;
}) {
  const width = 248;
  const height = 250;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(8, Math.min(vw - width - 8, mine ? rect.right - width : rect.left));
  const top = rect.bottom + height + 8 < vh ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
  const canEdit = mine && m.kind === 'text' && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW;
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <PopMenu onClose={onClose} className="msg-menu" style={{ left, top, width }}>
      <div className="quick-reactions" role="group" aria-label="React">
        {QUICK.map((e) => (
          <button
            key={e}
            type="button"
            className={myReaction === e ? 'is-picked' : ''}
            aria-label={myReaction === e ? `Remove ${e} reaction` : `React with ${e}`}
            onClick={act(() => onReact(myReaction === e ? null : e))}
          >
            {e}
          </button>
        ))}
      </div>
      <button type="button" role="menuitem" onClick={act(onReply)}>
        <IconReply size={18} /> Reply
      </button>
      {m.kind === 'text' && m.body ? (
        <button
          type="button"
          role="menuitem"
          onClick={act(() => {
            navigator.clipboard?.writeText(m.body ?? '').then(
              () => toast('Copied'),
              () => toast('Could not copy', 'error'),
            );
          })}
        >
          <IconCopy size={18} /> Copy text
        </button>
      ) : null}
      {canEdit ? (
        <button type="button" role="menuitem" onClick={act(onEdit)}>
          <IconEdit size={18} /> Edit
        </button>
      ) : null}
      {mine ? (
        <button type="button" role="menuitem" className="danger" onClick={act(onDelete)}>
          <IconTrash size={18} /> Delete for everyone
        </button>
      ) : null}
    </PopMenu>
  );
}
