import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL, ApiError, adoptSession, api } from '../lib/api';
import { actions } from '../lib/store';
import type { AuthResponse } from '../lib/types';
import { Logo } from '../components/Icons';
import { Field } from '../components/ui';
import { Waveform } from '../components/VoicePlayer';

const DEMO_WAVE = [18, 34, 60, 42, 75, 90, 55, 38, 66, 82, 48, 30, 58, 72, 40, 24, 50, 68, 86, 62, 36, 20, 44, 28];

function Demo() {
  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-bubble demo-peer" style={{ ['--d' as string]: '0.2s' }}>
        Are you still coming tonight?
      </div>
      <div className="demo-bubble demo-mine" style={{ ['--d' as string]: '0.9s' }}>
        Running late, the bus broke down
      </div>
      <div className="demo-bubble demo-mine demo-voice" style={{ ['--d' as string]: '1.6s' }}>
        <span className="demo-play" />
        <Waveform values={DEMO_WAVE} progress={0.42} />
        <span className="demo-time">0:14</span>
      </div>
      <div className="demo-bubble demo-peer" style={{ ['--d' as string]: '2.4s' }}>
        Ha, that voice note. See you at 8
      </div>
    </div>
  );
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);

  // Free Hugging Face Spaces sleep when idle: warm the API up while the user types.
  useEffect(() => {
    const slow = window.setTimeout(() => setWaking(true), 2500);
    fetch(`${API_URL}/health`)
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(slow);
        setWaking(false);
      });
    return () => window.clearTimeout(slow);
  }, []);

  useEffect(() => {
    setError(null);
    setTouched({});
  }, [mode]);

  const u = username.trim().toLowerCase();
  const errors = {
    username: mode === 'register' && !USERNAME_RE.test(u) ? '3 to 20 characters: letters, numbers and underscores' : !u ? 'Enter your username' : null,
    displayName: mode === 'register' && !displayName.trim() ? 'Enter the name people will see' : null,
    password:
      mode === 'register' && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        ? 'At least 8 characters with a letter and a number'
        : !password
          ? 'Enter your password'
          : null,
  };
  const shown = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, displayName: true, password: true });
    if (errors.username || errors.password || (mode === 'register' && errors.displayName)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthResponse>(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        auth: false,
        body: mode === 'login' ? { username: u, password } : { username: u, displayName: displayName.trim(), password },
      });
      adoptSession(res);
      actions.setMe(res.user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <section className="auth-hero">
        <div className="brand brand-light">
          <Logo size={34} />
          <span>HeyChat</span>
        </div>
        <h1>Say it in your own voice.</h1>
        <p>A private one-to-one messenger for texts, photos and voice notes that land the moment you hit send.</p>
        <Demo />
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit} noValidate>
          <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
          <p className="muted">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Link>
          </p>

          <Field label="Username" id="f-username" error={shown('username')} hint={mode === 'register' ? 'Friends find you by this. Lowercase letters, numbers and _' : undefined}>
            <input
              id="f-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              aria-invalid={Boolean(shown('username'))}
              aria-describedby={shown('username') ? 'f-username-error' : undefined}
              required
            />
          </Field>

          {mode === 'register' ? (
            <Field label="Your name" id="f-name" error={shown('displayName')}>
              <input
                id="f-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
                autoComplete="name"
                maxLength={40}
                aria-invalid={Boolean(shown('displayName'))}
                required
              />
            </Field>
          ) : null}

          <Field label="Password" id="f-password" error={shown('password')}>
            <div className="pw-wrap">
              <input
                id="f-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={128}
                aria-invalid={Boolean(shown('password'))}
                required
              />
              <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          {waking ? <p className="muted small center">Waking up the server. The first request can take up to a minute.</p> : null}

          <p className="legal-note">
            By continuing you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy policy</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
