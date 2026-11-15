import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ChatView } from './components/ChatView';
import { Logo } from './components/Icons';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { Spinner, toast, Toasts } from './components/ui';
import { api, ApiError, clearSession, hasStoredSession, onSessionLost, refreshSession } from './lib/api';
import { actions, totalUnread, useStore } from './lib/store';
import { startSync, stopSync } from './lib/sync';
import type { Conversation, User } from './lib/types';
import { AuthPage } from './pages/AuthPage';
import { LegalPage, NotFound } from './pages/LegalPage';

/** Restores the session from the stored refresh token, once, on first load. */
function useBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasStoredSession() || !(await refreshSession())) {
        if (!cancelled) actions.setMe(null);
        return;
      }
      try {
        const { user } = await api<{ user: User }>('/auth/me');
        if (!cancelled) actions.setMe(user);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) clearSession();
        if (!cancelled) actions.setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading HeyChat">
      <Logo size={56} />
      <Spinner label="Loading" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.me);
  const ready = useStore((s) => s.authReady);
  if (!ready) return <Splash />;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.me);
  const ready = useStore((s) => s.authReady);
  if (!ready) return <Splash />;
  if (me) return <Navigate to="/chat" replace />;
  return <>{children}</>;
}

function Welcome() {
  return (
    <section className="welcome" aria-label="No chat selected">
      <div className="welcome-art" aria-hidden="true">
        <span className="welcome-bubble a" />
        <span className="welcome-bubble b" />
        <span className="welcome-bubble c" />
      </div>
      <h2>Pick a chat or start a new one</h2>
      <p className="muted">Search for a friend by username in the panel on the left. Messages, photos and voice notes arrive instantly.</p>
    </section>
  );
}

function ChatRoute() {
  const { id } = useParams<{ id: string }>();
  const conv = useStore((s) => (id ? s.conversations[id] : undefined));
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    if (!id || conv) return;
    let alive = true;
    api<{ conversation: Conversation }>(`/conversations/${id}`)
      .then(({ conversation }) => alive && actions.upsertConversation(conversation))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return <Welcome />;
  if (conv) return <ChatView key={conv.id} conv={conv} />;
  if (missing) {
    return (
      <section className="welcome">
        <h2>Chat not found</h2>
        <p className="muted">It may have been removed, or the link is wrong.</p>
      </section>
    );
  }
  return (
    <section className="welcome">
      <Spinner label="Opening chat" />
    </section>
  );
}

function Shell() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(false);
  const conversations = useStore((s) => s.conversations);

  useEffect(() => {
    startSync();
    return () => stopSync();
  }, []);

  useEffect(() => {
    const n = totalUnread(conversations);
    document.title = n ? `(${n}) HeyChat` : 'HeyChat';
  }, [conversations]);

  return (
    <div className={`shell ${id ? 'has-active' : ''}`}>
      <Sidebar onOpenSettings={() => setSettings(true)} />
      <main className="pane">
        <ChatRoute />
      </main>
      <SettingsPanel
        open={settings}
        onClose={() => setSettings(false)}
        onSignedOut={() => {
          setSettings(false);
          stopSync();
          actions.reset();
          actions.setMe(null);
          navigate('/login', { replace: true });
        }}
      />
    </div>
  );
}

export function App() {
  useBootstrap();
  const navigate = useNavigate();

  useEffect(() => {
    const off = onSessionLost(() => {
        if (!useStore.getState().me) return;
        stopSync();
        actions.reset();
        actions.setMe(null);
        toast('You were signed out. Please sign in again.');
        navigate('/login', { replace: true });
    });
    return () => {
      off();
    };
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
        {/* One route with an optional id so switching chats never remounts the shell (and its socket). */}
        <Route path="/chat/:id?" element={<RequireAuth><Shell /></RequireAuth>} />
        <Route path="/privacy" element={<LegalPage page="privacy" />} />
        <Route path="/terms" element={<LegalPage page="terms" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toasts />
    </>
  );
}
