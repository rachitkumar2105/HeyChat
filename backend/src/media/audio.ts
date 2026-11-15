import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { badRequest } from '../lib/errors.js';

const AUDIO_TYPES = new Set([
  'audio/webm', 'video/webm', 'audio/ogg', 'audio/opus', 'audio/mp4', 'video/mp4', 'audio/x-m4a',
  'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/vnd.wave', 'audio/3gpp', 'video/3gpp',
]);

export interface ProcessedVoice {
  data: Buffer;
  mime: 'audio/mpeg';
  durationMs: number;
  /** 48 bars, each 0-100, for the waveform drawn in the chat bubble. */
  waveform: number[];
}

const WAVEFORM_BARS = 48;

// Two ffmpeg jobs at most: free Spaces have 2 vCPUs.
let running = 0;
const queue: Array<() => void> = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => queue.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d: Buffer) => {
      size += d.length;
      if (size > 64 * 1024 * 1024) child.kill('SIGKILL');
      else out.push(d);
    });
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited with ${code}`));
    });
  });
}

/** Peak amplitude per bar from 16-bit mono PCM, normalised so the loudest bar is 100. */
export function computeWaveform(pcm: Buffer, bars = WAVEFORM_BARS): number[] {
  const samples = Math.floor(pcm.length / 2);
  if (samples === 0) return new Array(bars).fill(4);
  const per = Math.max(1, Math.floor(samples / bars));
  const peaks: number[] = [];
  for (let b = 0; b < bars; b++) {
    let peak = 0;
    const start = b * per;
    const end = Math.min(samples, start + per);
    for (let i = start; i < end; i++) {
      const v = Math.abs(pcm.readInt16LE(i * 2));
      if (v > peak) peak = v;
    }
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 1);
  return peaks.map((p) => Math.max(4, Math.round((p / max) * 100)));
}

/**
 * Validates and transcodes a recorded voice note to MP3. Browsers record in different
 * containers (Chrome/Firefox: WebM/Opus, Safari: MP4/AAC), and no single one of those plays
 * everywhere; MP3 does. Transcoding also proves the file really is audio and measures the
 * true duration server-side instead of trusting the client.
 */
export async function processVoice(buf: Buffer, maxSeconds: number): Promise<ProcessedVoice> {
  const type = await fileTypeFromBuffer(buf);
  if (!type || !AUDIO_TYPES.has(type.mime)) {
    throw badRequest('unsupported_audio', 'That voice note format is not supported.');
  }

  return withSlot(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hc-voice-'));
    const input = path.join(dir, `${randomUUID()}.${type.ext}`);
    const output = path.join(dir, 'out.mp3');
    try {
      await writeFile(input, buf);
      const common = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-i', input, '-vn', '-sn', '-dn', '-t', String(maxSeconds + 1)];
      await run('ffmpeg', [...common, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', '-y', output], 60_000);
      const pcm = await run('ffmpeg', [...common, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], 30_000);
      const durationMs = Math.round((pcm.length / 2 / 8000) * 1000);
      if (durationMs < 300) throw badRequest('voice_too_short', 'That voice note is too short.');
      if (durationMs > maxSeconds * 1000 + 500) {
        throw badRequest('voice_too_long', `Voice notes can be up to ${Math.round(maxSeconds / 60)} minutes.`);
      }
      const data = await readFile(output);
      return { data, mime: 'audio/mpeg', durationMs, waveform: computeWaveform(pcm) };
    } catch (e) {
      if ((e as { status?: number }).status === 400) throw e;
      throw badRequest('invalid_audio', 'That voice note could not be processed.');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
