import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { duration } from '../lib/format';
import { IconPause, IconPlay } from './Icons';

let current: HTMLAudioElement | null = null;
const RATES = [1, 1.5, 2];

export function Waveform({ values, progress = 0, live }: { values: number[]; progress?: number; live?: boolean }) {
  const bars = values.length ? values : new Array(48).fill(10);
  return (
    <span className={`wave ${live ? 'wave-live' : ''}`} aria-hidden="true">
      {bars.map((v, i) => (
        <span
          key={i}
          className={`wave-bar ${i / bars.length < progress ? 'is-played' : ''}`}
          style={{ height: `${Math.max(10, Math.min(100, v))}%` }}
        />
      ))}
    </span>
  );
}

export function VoicePlayer({ src, durationMs, waveform, mine }: { src: string; durationMs: number; waveform?: number[]; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState(false);
  const total = durationMs || 1;

  useEffect(() => {
    const a = new Audio();
    a.preload = 'none';
    a.src = src;
    audio.current = a;
    let raf = 0;
    const loop = () => {
      setPos(a.currentTime * 1000);
      raf = requestAnimationFrame(loop);
    };
    a.onplay = () => {
      setPlaying(true);
      raf = requestAnimationFrame(loop);
    };
    a.onpause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      setPos(a.currentTime * 1000);
    };
    a.onended = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      setPos(0);
      a.currentTime = 0;
    };
    a.onerror = () => setError(true);
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      if (current === a) current = null;
      a.src = '';
    };
  }, [src]);

  const toggle = async () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      a.playbackRate = rate;
      try {
        setError(false);
        await a.play();
      } catch {
        setError(true);
      }
    } else a.pause();
  };

  const seekTo = (fraction: number) => {
    const a = audio.current;
    if (!a) return;
    const t = Math.max(0, Math.min(1, fraction)) * (total / 1000);
    a.currentTime = t;
    setPos(t * 1000);
  };

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - r.left) / r.width);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 5000 / total;
    if (e.key === 'ArrowRight') seekTo(pos / total + step);
    else if (e.key === 'ArrowLeft') seekTo(pos / total - step);
    else return;
    e.preventDefault();
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const progress = pos / total;
  return (
    <div className={`voice ${mine ? 'voice-mine' : ''}`}>
      <button type="button" className="voice-play" onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'}>
        {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
      </button>
      <div className="voice-body">
        <div
          className="voice-track"
          role="slider"
          tabIndex={0}
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={Math.round(total / 1000)}
          aria-valuenow={Math.round(pos / 1000)}
          aria-valuetext={`${duration(pos)} of ${duration(total)}`}
          onPointerDown={onPointer}
          onKeyDown={onKey}
        >
          <Waveform values={waveform ?? []} progress={progress} />
        </div>
        <div className="voice-meta">
          <span>{error ? 'Could not play' : duration(playing || pos > 0 ? pos : total)}</span>
          {playing || pos > 0 ? (
            <button type="button" className="voice-rate" onClick={cycleRate} aria-label={`Playback speed ${rate}x`}>
              {rate}x
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
