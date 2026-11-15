import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { adoptSession, api, logoutRequest, uploadForm } from '../lib/api';
import { actions, useStore } from '../lib/store';
import type { AuthResponse, User } from '../lib/types';
import { IconBell, IconCamera, IconLock, IconLogout, IconTrash } from './Icons';
import { Avatar, Dialog, Field, Spinner, toast } from './ui';

export function SettingsPanel({ open, onClose, onSignedOut }: { open: boolean; onClose: () => void; onSignedOut: () => void }) {
  const me = useStore((s) => s.me)!;
  const notify = useStore((s) => s.notify);
  const [name, setName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(me.displayName);
      setBio(me.bio);
    }
  }, [open, me.displayName, me.bio]);

  const dirty = name.trim() !== me.displayName || bio.trim() !== me.bio;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast('Your name cannot be empty.', 'error');
    setSaving(true);
    try {
      const { user } = await api<{ user: User }>('/users/me', { method: 'PATCH', body: { displayName: name.trim(), bio: bio.trim() } });
      actions.updateUser(user);
      toast('Profile saved');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) return toast('Profile photos can be up to 5 MB.', 'error');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const { user } = await uploadForm<{ user: User }>('/users/me/avatar', form);
      actions.updateUser(user);
      toast('Profile photo updated');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      const { user } = await api<{ user: User }>('/users/me/avatar', { method: 'DELETE' });
      actions.updateUser(user);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const toggleNotify = async () => {
    if (notify) return actions.setNotify(false);
    if (typeof Notification === 'undefined') return toast('This browser does not support notifications.', 'error');
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') {
      actions.setNotify(true);
      toast('Notifications on');
    } else toast('Notifications are blocked for this site in your browser settings.', 'error');
  };

  const signOut = async () => {
    await logoutRequest();
    onSignedOut();
  };

  const signOutEverywhere = async () => {
    try {
      await api('/auth/logout-all', { method: 'POST' });
    } catch {
      /* fall through to local sign out */
    }
    await logoutRequest();
    onSignedOut();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Profile and settings" className="settings">
        <form className="settings-profile" onSubmit={save}>
          <div className="settings-avatar">
            <Avatar user={me} size={88} />
            <button type="button" className="avatar-edit" onClick={() => file.current?.click()} aria-label="Change profile photo" title="Change profile photo" disabled={uploading}>
              {uploading ? <Spinner label="Uploading" /> : <IconCamera size={18} />}
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void uploadAvatar(f);
              }}
            />
          </div>
          {me.avatarUrl ? (
            <button type="button" className="link-btn" onClick={removeAvatar}>
              Remove photo
            </button>
          ) : null}
          <p className="muted center">@{me.username}</p>
          <Field label="Display name" id="set-name">
            <input id="set-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="About" id="set-bio" hint={`${bio.length}/160`}>
            <textarea id="set-bio" value={bio} maxLength={160} rows={2} onChange={(e) => setBio(e.target.value)} placeholder="A line about you" />
          </Field>
          <button type="submit" className="btn" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <div className="settings-list">
          <button type="button" className="settings-row" onClick={toggleNotify} role="switch" aria-checked={notify}>
            <IconBell size={20} />
            <span>
              Desktop notifications
              <small>Show new messages when HeyChat is in the background</small>
            </span>
            <span className={`switch ${notify ? 'is-on' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" className="settings-row" onClick={() => setPwOpen(true)}>
            <IconLock size={20} />
            <span>Change password</span>
          </button>
          <button type="button" className="settings-row" onClick={signOut}>
            <IconLogout size={20} />
            <span>Sign out</span>
          </button>
          <button type="button" className="settings-row" onClick={signOutEverywhere}>
            <IconLogout size={20} />
            <span>
              Sign out on all devices
              <small>Ends every session, including this one</small>
            </span>
          </button>
          <button type="button" className="settings-row danger" onClick={() => setDelOpen(true)}>
            <IconTrash size={20} />
            <span>Delete account</span>
          </button>
        </div>
        <p className="settings-legal">
          <Link to="/privacy" onClick={onClose}>Privacy</Link>
          <Link to="/terms" onClick={onClose}>Terms</Link>
        </p>
      </Dialog>

      <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteDialog open={delOpen} onClose={() => setDelOpen(false)} onDeleted={onSignedOut} />
    </>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setError(null);
    }
  }, [open]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthResponse>('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      adoptSession(res);
      toast('Password changed. Other devices were signed out.');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Change password">
      <form className="stack" onSubmit={submit}>
        <Field label="Current password" id="pw-current">
          <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="New password" id="pw-new" hint="At least 8 characters with a letter and a number">
          <input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
        </Field>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
    }
  }, [open]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/users/me/delete', { method: 'POST', body: { password } });
      await logoutRequest();
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Delete your account?">
      <form className="stack" onSubmit={submit}>
        <p>
          This permanently deletes your profile, your chats and every photo and voice message in them, for both sides. It cannot be undone.
        </p>
        <Field label="Enter your password to confirm" id="del-pw">
          <input id="del-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Keep my account
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy || !password}>
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
