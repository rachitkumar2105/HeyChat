import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { duration, listTime } from '../lib/format';
import { useStore } from '../lib/store';
import { openChatWith } from '../lib/sync';
import type { Conversation, User } from '../lib/types';
import { IconClose, IconCompose, IconImage, IconSearch, IconSettings, IconTick, IconTicks, IconWave, Logo } from './Icons';
import { Avatar, Spinner, toast } from './ui';

function Preview({ c, myId, typing }: { c: Conversation; myId: string; typing: boolean }) {
  if (typing) return <span className="preview is-typing">typing…</span>;
  const m = c.lastMessage;
  if (!m) return <span className="preview muted">Say hello</span>;
  const mine = m.senderId === myId;
  const read = mine && m.id <= c.peerLastReadId;
  const delivered = mine && m.id <= c.peerLastDeliveredId;
  return (
    <span className="preview">
      {mine && !m.deletedAt ? (
        delivered ? (
          <IconTicks size={15} className={`tick ${read ? 'tick-read' : ''}`} aria-label={read ? 'Read' : 'Delivered'} role="img" aria-hidden="false" />
        ) : (
          <IconTick size={15} className="tick" aria-label="Sent" role="img" aria-hidden="false" />
        )
      ) : null}
      {m.deletedAt ? (
        <em>Message deleted</em>
      ) : m.kind === 'image' ? (
        <>
          <IconImage size={15} /> {m.body || 'Photo'}
        </>
      ) : m.kind === 'voice' ? (
        <>
          <IconWave size={15} /> Voice message {duration(m.media?.durationMs ?? 0)}
        </>
      ) : (
        m.body
      )}
    </span>
  );
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const me = useStore((s) => s.me)!;
  const conversations = useStore((s) => s.conversations);
  const typing = useStore((s) => s.typing);
  const connection = useStore((s) => s.connection);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const list = useMemo(
    () =>
      Object.values(conversations).sort((a, b) =>
        (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
      ),
    [conversations],
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? list.filter((c) => c.peer.displayName.toLowerCase().includes(q) || c.peer.username.includes(q))
    : list;

  useEffect(() => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const id = window.setTimeout(() => {
      api<{ users: User[] }>(`/users/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => setResults(r.users))
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setResults([]);
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [q]);

  const knownPeers = new Set(list.map((c) => c.peer.id));
  const people = (results ?? []).filter((u) => !knownPeers.has(u.id));

  const start = async (u: User) => {
    try {
      const c = await openChatWith(u.id);
      setQuery('');
      navigate(`/chat/${c.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <aside className="sidebar" aria-label="Chats">
      <header className="side-head">
        <div className="brand">
          <Logo size={30} />
          <span>HeyChat</span>
        </div>
        <div className="side-actions">
          <button type="button" className="icon-btn" onClick={() => searchRef.current?.focus()} aria-label="Start a new chat" title="Start a new chat">
            <IconCompose />
          </button>
          <button type="button" className="me-btn" onClick={onOpenSettings} aria-label="Profile and settings" title="Profile and settings">
            <Avatar user={me} size={34} />
            <IconSettings size={16} className="me-btn-gear" />
          </button>
        </div>
      </header>

      {connection !== 'online' ? (
        <div className="conn-banner" role="status">
          <Spinner label="Reconnecting" /> {connection === 'connecting' ? 'Connecting…' : 'Reconnecting… messages will sync automatically.'}
        </div>
      ) : null}

      <div className="search">
        <IconSearch size={18} />
        <label htmlFor="side-search" className="sr-only">
          Search chats or find people
        </label>
        <input
          id="side-search"
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Search or find people by username"
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" className="icon-btn small" onClick={() => setQuery('')} aria-label="Clear search">
            <IconClose size={16} />
          </button>
        ) : null}
      </div>

      <nav className="chat-list" aria-label="Conversations">
        {filtered.length ? (
          <ul>
            {filtered.map((c) => {
              const isTyping = (typing[c.id] ?? 0) > Date.now();
              return (
                <li key={c.id}>
                  <NavLink to={`/chat/${c.id}`} className={({ isActive }) => `chat-item ${isActive ? 'is-active' : ''}`}>
                    <Avatar user={c.peer} size={48} online={c.peer.online} />
                    <span className="chat-item-body">
                      <span className="chat-item-top">
                        <strong>{c.peer.displayName}</strong>
                        <time className={c.unreadCount ? 'has-unread' : ''}>{listTime(c.lastMessageAt)}</time>
                      </span>
                      <span className="chat-item-bottom">
                        <Preview c={c} myId={me.id} typing={isTyping} />
                        {c.unreadCount > 0 ? (
                          <span className="badge" aria-label={`${c.unreadCount} unread`}>
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ) : !q ? (
          <div className="empty-list">
            <p>No chats yet.</p>
            <p className="muted">Search for a friend by their username to start talking.</p>
            <button type="button" className="btn" onClick={() => searchRef.current?.focus()}>
              Find people
            </button>
          </div>
        ) : null}

        {q.length >= 2 ? (
          <div className="people">
            <h3>People</h3>
            {searching && !results ? (
              <div className="people-loading">
                <Spinner label="Searching" />
              </div>
            ) : people.length ? (
              <ul>
                {people.map((u) => (
                  <li key={u.id}>
                    <button type="button" className="chat-item" onClick={() => start(u)}>
                      <Avatar user={u} size={44} />
                      <span className="chat-item-body">
                        <strong>{u.displayName}</strong>
                        <span className="preview muted">@{u.username}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted people-empty">
                {filtered.length ? 'No one else matches.' : `No one found for "${query.trim()}". Check the username and try again.`}
              </p>
            )}
          </div>
        ) : q.length === 1 ? (
          <p className="muted people-empty">Type at least 2 characters to find people.</p>
        ) : null}
      </nav>
    </aside>
  );
}
