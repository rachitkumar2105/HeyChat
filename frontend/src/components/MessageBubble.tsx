import { memo, useRef, type MouseEvent, type TouchEvent } from 'react';
import { clockTime, splitLinks } from '../lib/format';
import { discard, retry } from '../lib/sync';
import type { LocalMessage } from '../lib/types';
import { IconAlert, IconClock, IconImage, IconMore, IconRetry, IconTick, IconTicks, IconTrash, IconWave } from './Icons';
import { VoicePlayer } from './VoicePlayer';

export type Status = 'pending' | 'failed' | 'sent' | 'delivered' | 'read';

interface Props {
  m: LocalMessage;
  mine: boolean;
  status: Status | null;
  peerName: string;
  myId: string;
  grouped: boolean;
  highlighted: boolean;
  onMenu: (m: LocalMessage, rect: DOMRect) => void;
  onOpenImage: (m: LocalMessage) => void;
  onJumpTo: (id: number) => void;
}

function Text({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function StatusMark({ status }: { status: Status }) {
  if (status === 'pending') return <IconClock size={13} aria-label="Sending" />;
  if (status === 'failed') return <IconAlert size={14} aria-label="Not sent" />;
  if (status === 'sent') return <IconTick size={16} className="tick" aria-label="Sent" role="img" aria-hidden="false" />;
  return (
    <IconTicks
      size={16}
      className={`tick ${status === 'read' ? 'tick-read' : ''}`}
      aria-label={status === 'read' ? 'Read' : 'Delivered'}
      role="img"
      aria-hidden="false"
    />
  );
}

export const MessageBubble = memo(function MessageBubble({
  m,
  mine,
  status,
  peerName,
  myId,
  grouped,
  highlighted,
  onMenu,
  onOpenImage,
  onJumpTo,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const press = useRef<number>(0);
  const deleted = Boolean(m.deletedAt);
  const canAct = m.id > 0 && !deleted;

  const openMenu = () => {
    if (canAct && ref.current) onMenu(m, ref.current.getBoundingClientRect());
  };
  const onContext = (e: MouseEvent) => {
    if (!canAct) return;
    if ((e.target as HTMLElement).closest('a')) return;
    e.preventDefault();
    openMenu();
  };
  const onTouchStart = (e: TouchEvent) => {
    if (!canAct || (e.target as HTMLElement).closest('button, a, [role="slider"]')) return;
    press.current = window.setTimeout(() => {
      navigator.vibrate?.(12);
      openMenu();
    }, 450);
  };
  const cancelPress = () => window.clearTimeout(press.current);

  const reactionGroups = Object.entries(
    m.reactions.reduce<Record<string, string[]>>((acc, r) => {
      (acc[r.emoji] ??= []).push(r.userId);
      return acc;
    }, {}),
  );

  const img = m.kind === 'image' && m.media ? m.media : null;
  const ratio = img?.width && img?.height ? img.width / img.height : 4 / 3;

  return (
    <div
      id={m.id > 0 ? `m-${m.id}` : undefined}
      className={`row ${mine ? 'row-mine' : 'row-peer'} ${grouped ? 'row-grouped' : ''} ${highlighted ? 'row-flash' : ''}`}
    >
      <div
        ref={ref}
        className={`bubble ${mine ? 'bubble-mine' : 'bubble-peer'} ${img && !deleted ? 'bubble-image' : ''} ${deleted ? 'bubble-deleted' : ''} ${m.failed ? 'bubble-failed' : ''}`}
        onContextMenu={onContext}
        onTouchStart={onTouchStart}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
      >
        {m.replyTo && !deleted ? (
          <button type="button" className="quote" onClick={() => onJumpTo(m.replyTo!.id)}>
            <span className="quote-who">{m.replyTo.senderId === myId ? 'You' : peerName}</span>
            <span className="quote-text">
              {m.replyTo.deleted ? (
                'Message deleted'
              ) : m.replyTo.kind === 'image' ? (
                <>
                  <IconImage size={14} /> {m.replyTo.body || 'Photo'}
                </>
              ) : m.replyTo.kind === 'voice' ? (
                <>
                  <IconWave size={14} /> Voice message
                </>
              ) : (
                m.replyTo.body
              )}
            </span>
          </button>
        ) : null}

        {deleted ? (
          <p className="bubble-text deleted-text">
            <IconTrash size={14} /> {mine ? 'You deleted this message' : 'This message was deleted'}
          </p>
        ) : img ? (
          <button
            type="button"
            className="photo"
            style={{ aspectRatio: String(Math.max(0.5, Math.min(2, ratio))), backgroundImage: img.preview ? `url(${img.preview})` : undefined }}
            onClick={() => onOpenImage(m)}
            aria-label="Open photo"
          >
            <img src={img.url} alt={m.body ? `Photo: ${m.body}` : 'Photo'} loading="lazy" decoding="async" />
            {m.pending && m.progress !== undefined ? (
              <span className="photo-progress" aria-label={`Uploading ${Math.round(m.progress * 100)}%`}>
                <span style={{ width: `${Math.round(m.progress * 100)}%` }} />
              </span>
            ) : null}
          </button>
        ) : m.kind === 'voice' && m.media ? (
          <VoicePlayer src={m.media.url} durationMs={m.media.durationMs ?? 0} waveform={m.media.waveform} mine={mine} />
        ) : null}

        {!deleted && m.body && (m.kind === 'text' || img) ? (
          <p className="bubble-text">
            <Text text={m.body} />
          </p>
        ) : null}

        <span className="meta">
          {m.editedAt && !deleted ? <span className="edited">edited</span> : null}
          <time dateTime={m.createdAt}>{clockTime(m.createdAt)}</time>
          {mine && status ? <StatusMark status={status} /> : null}
        </span>

        {canAct ? (
          <button type="button" className="bubble-more" onClick={openMenu} aria-label="Message options" title="Message options">
            <IconMore size={16} />
          </button>
        ) : null}

        {reactionGroups.length ? (
          <span className="reactions">
            {reactionGroups.map(([emoji, users]) => (
              <span key={emoji} className={`reaction ${users.includes(myId) ? 'reaction-mine' : ''}`} title={users.length > 1 ? 'Both reacted' : users[0] === myId ? 'You reacted' : `${peerName} reacted`}>
                {emoji}
                {users.length > 1 ? <span className="reaction-count">{users.length}</span> : null}
              </span>
            ))}
          </span>
        ) : null}
      </div>

      {m.failed ? (
        <div className="failed-row" role="alert">
          <span>{m.failed}</span>
          <button type="button" onClick={() => retry(m)}>
            <IconRetry size={14} /> Retry
          </button>
          <button type="button" onClick={() => discard(m)}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
});
