/**
 * Voice recorder: MediaRecorder for the file, an AnalyserNode for the live level meter.
 * Picks a container the current browser can actually record (Safari records MP4/AAC).
 */
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2'];

export function recordingSupported() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

export interface Recording {
  blob: Blob;
  durationMs: number;
  levels: number[];
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private startedAt = 0;
  private raf = 0;
  readonly levels: number[] = [];
  onLevel?: (level: number, elapsedMs: number) => void;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const mime = CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(250);
    this.startedAt = performance.now();

    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      let lastSample = 0;
      const tick = () => {
        this.analyser!.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        const level = Math.min(1, Math.sqrt(peak / 128) * 1.15);
        const elapsed = performance.now() - this.startedAt;
        if (elapsed - lastSample > 100) {
          this.levels.push(level);
          lastSample = elapsed;
        }
        this.onLevel?.(level, elapsed);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch {
      /* metering is optional */
    }
  }

  elapsed() {
    return this.startedAt ? performance.now() - this.startedAt : 0;
  }

  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) return reject(new Error('not recording'));
      const durationMs = this.elapsed();
      rec.onstop = () => {
        const type = rec.mimeType || this.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.chunks, { type: type.split(';')[0] });
        this.cleanup();
        resolve({ blob, durationMs, levels: downsample(this.levels, 48) });
      };
      if (rec.state !== 'inactive') rec.stop();
      else rec.onstop(new Event('stop'));
    });
  }

  cancel() {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.onstop = null;
        this.recorder.stop();
      }
    } finally {
      this.cleanup();
    }
  }

  private cleanup() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.recorder = null;
    this.ctx = null;
  }
}

export function downsample(values: number[], n: number): number[] {
  if (values.length === 0) return new Array(n).fill(8);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * values.length) / n);
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / n));
    let peak = 0;
    for (let j = start; j < end && j < values.length; j++) peak = Math.max(peak, values[j]!);
    out.push(Math.round(peak * 100));
  }
  return out;
}
