import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { duration, previewText } from '../lib/format';
import { recordingSupported, VoiceRecorder } from '../lib/recorder';
import { editMessage, sendMedia, sendText, sendTyping } from '../lib/sync';
import type { Conversation, Message } from '../lib/types';
import { IconClose, IconEdit, IconImage, IconMic, IconReply, IconSend, IconTrash } from './Icons';
import { Dialog, toast } from './ui';
import { Waveform } from './VoicePlayer';

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VOICE_MS = 5 * 60 * 1000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'];

interface Props {
  conv: Conversation;
  replyTo: Message | null;
  editing: Message | null;
  onDone: () => void;
  peerName: string;
  myId: string;
}

export function Composer({ conv, replyTo, editing, onDone, peerName, myId }: Props) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [photo, setPhoto] = useState<{ file: File; url: string; width: number; height: number } | null>(null);
  const [caption, setCaption] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<VoiceRecorder | null>(null);
  const drafts = useRef<Record<string, string>>({});

  // Per-chat drafts.
  useEffect(() => {
    setText(drafts.current[conv.id] ?? '');
    return () => {
      recorder.current?.cancel();
      recorder.current = null;
      setRecording(false);
    };
  }, [conv.id]);

  useEffect(() => {
    if (editing) {
      setText(editing.body ?? '');
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) input.current?.focus();
  }, [replyTo]);

  // Auto-grow textarea.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text, recording]);

  const blocked = conv.blockedByMe;

  const updateText = (v: string) => {
    setText(v);
    if (!editing) drafts.current[conv.id] = v;
    if (v.trim() && !editing) sendTyping(conv, true);
  };

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    if (body.length > 4000) {
      toast('Messages can be up to 4000 characters.', 'error');
      return;
    }
    if (editing) {
      try {
        if (body !== editing.body) await editMessage(editing, body);
        setText('');
        onDone();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      return;
    }
    setText('');
    drafts.current[conv.id] = '';
    sendTyping(conv, false);
    const reply = replyTo;
    onDone();
    await sendText(conv.id, body, reply);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
    if (e.key === 'Escape' && (editing || replyTo)) {
      setText(editing ? '' : text);
      onDone();
    }
  };

  const pickImage = async (file: File) => {
    if (!IMAGE_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
      toast('Please choose a JPG, PNG, WebP, GIF or HEIC image.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE) {
      toast('Images can be up to 10 MB.', 'error');
      return;
    }
    const url = URL.createObjectURL(file);
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 4, height: 3 });
      img.src = url;
    });
    setCaption(text);
    setPhoto({ file, url, ...dims });
  };

  const onPaste = (e: ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      void pickImage(file);
    }
  };

  const sendPhoto = async () => {
    if (!photo) return;
    const p = photo;
    const cap = caption.trim().slice(0, 1000);
    setPhoto(null);
    setCaption('');
    if (cap && cap === text.trim()) {
      setText('');
      drafts.current[conv.id] = '';
    }
    const reply = replyTo;
    onDone();
    await sendMedia(conv.id, 'image', p.file, { caption: cap || undefined, reply, width: p.width, height: p.height });
    URL.revokeObjectURL(p.url);
  };

  const startRecording = async () => {
    if (!recordingSupported()) {
      toast('Voice recording is not supported in this browser.', 'error');
      return;
    }
    const r = new VoiceRecorder();
    const live: number[] = [];
    r.onLevel = (level, ms) => {
      setElapsed(ms);
      if (live.length === 0 || ms / 120 > live.length) {
        live.push(level * 100);
        setLevels(live.slice(-40));
      }
      if (ms >= MAX_VOICE_MS) void finishRecording();
    };
    try {
      await r.start();
      recorder.current = r;
      setLevels([]);
      setElapsed(0);
      setRecording(true);
      sendTyping(conv, true);
    } catch (e) {
      const name = (e as Error).name;
      toast(
        name === 'NotAllowedError'
          ? 'Microphone access is blocked. Allow it in your browser settings to record.'
          : 'No microphone found.',
        'error',
      );
    }
  };

  const cancelRecording = () => {
    recorder.current?.cancel();
    recorder.current = null;
    setRecording(false);
    sendTyping(conv, false);
  };

  const finishRecording = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    setRecording(false);
    sendTyping(conv, false);
    try {
      const rec = await r.stop();
      if (rec.durationMs < 600) {
        toast('Hold on a little longer to record a voice message.');
        return;
      }
      const reply = replyTo;
      onDone();
      await sendMedia(conv.id, 'voice', rec.blob, { reply, durationMs: rec.durationMs, waveform: rec.levels });
    } catch {
      toast('Recording failed. Please try again.', 'error');
    }
  };

  if (blocked) {
    return <div className="composer composer-blocked">You blocked this person. Unblock them from the menu to send messages.</div>;
  }

  const banner = editing ? (
    <div className="composer-banner">
      <IconEdit size={18} />
      <div>
        <strong>Editing message</strong>
        <span>{editing.body}</span>
      </div>
      <button type="button" className="icon-btn" onClick={() => { setText(''); onDone(); }} aria-label="Cancel editing" title="Cancel editing">
        <IconClose size={18} />
      </button>
    </div>
  ) : replyTo ? (
    <div className="composer-banner">
      <IconReply size={18} />
      <div>
        <strong>Replying to {replyTo.senderId === myId ? 'yourself' : peerName}</strong>
        <span>{previewText(replyTo)}</span>
      </div>
      <button type="button" className="icon-btn" onClick={onDone} aria-label="Cancel reply" title="Cancel reply">
        <IconClose size={18} />
      </button>
    </div>
  ) : null;

  return (
    <div className="composer-wrap">
      {banner}
      {recording ? (
        <div className="composer composer-recording" role="group" aria-label="Recording voice message">
          <button type="button" className="icon-btn danger" onClick={cancelRecording} aria-label="Discard recording" title="Discard recording">
            <IconTrash />
          </button>
          <span className="rec-dot" aria-hidden="true" />
          <span className="rec-time" aria-live="off">{duration(elapsed)}</span>
          <div className="rec-wave">
            <Waveform values={[...new Array(Math.max(0, 40 - levels.length)).fill(4), ...levels]} live />
          </div>
          <button type="button" className="send-btn" onClick={finishRecording} aria-label="Send voice message" title="Send voice message">
            <IconSend />
          </button>
        </div>
      ) : (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {!editing ? (
            <>
              <button type="button" className="icon-btn" onClick={() => fileInput.current?.click()} aria-label="Send a photo" title="Send a photo">
                <IconImage />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void pickImage(f);
                }}
              />
            </>
          ) : null}
          <label htmlFor="composer-input" className="sr-only">
            Message
          </label>
          <textarea
            id="composer-input"
            ref={input}
            rows={1}
            value={text}
            maxLength={4200}
            placeholder={editing ? 'Edit message' : 'Write a message'}
            onChange={(e) => updateText(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            enterKeyHint="send"
            autoComplete="off"
          />
          {text.trim() ? (
            <button type="submit" className="send-btn" aria-label={editing ? 'Save edit' : 'Send message'} title={editing ? 'Save edit' : 'Send'}>
              <IconSend />
            </button>
          ) : !editing ? (
            <button type="button" className="send-btn mic-btn" onClick={startRecording} aria-label="Record a voice message" title="Record a voice message">
              <IconMic />
            </button>
          ) : null}
        </form>
      )}

      <Dialog open={Boolean(photo)} onClose={() => { if (photo) URL.revokeObjectURL(photo.url); setPhoto(null); }} title="Send photo">
        {photo ? (
          <form
            className="photo-send"
            onSubmit={(e) => {
              e.preventDefault();
              void sendPhoto();
            }}
          >
            <img src={photo.url} alt="Selected photo preview" />
            <label htmlFor="photo-caption" className="sr-only">
              Caption
            </label>
            <div className="photo-send-row">
              <input
                id="photo-caption"
                value={caption}
                maxLength={1000}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption"
                autoFocus
              />
              <button type="submit" className="send-btn" aria-label="Send photo" title="Send photo">
                <IconSend />
              </button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
