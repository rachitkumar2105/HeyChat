import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { initials, toneFor } from '../lib/format';
import { IconClose } from './Icons';

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export function Avatar({
  user,
  size = 44,
  online,
}: {
  user: { id: string; displayName: string; avatarUrl: string | null };
  size?: number;
  online?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user.avatarUrl]);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {user.avatarUrl && !broken ? (
        <img src={user.avatarUrl} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className="avatar-initials" style={{ background: toneFor(user.id) }} aria-hidden="true">
          {initials(user.displayName)}
        </span>
      )}
      {online ? <span className="avatar-dot" aria-label="Online" role="img" /> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dialog built on <dialog>: native focus trap, Esc to close, focus restore.
// ---------------------------------------------------------------------------
export function Dialog({
  open,
  onClose,
  title,
  children,
  className = '',
  hideTitle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="dialog-inner">
          <header className={`dialog-head ${hideTitle ? 'sr-only-head' : ''}`}>
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" title="Close">
              <IconClose />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}
const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let toastSeq = 0;
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++toastSeq;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
  window.setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), tone === 'error' ? 5000 : 3000);
}
export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
