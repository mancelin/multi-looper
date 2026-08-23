"use client";

/**
 * Microphone capture for the record modal.
 *
 * `MediaRecorder` produces the encoded blob; an `AnalyserNode` on the same
 * stream feeds the live meter. Levels are pushed to listeners from a
 * `requestAnimationFrame` tick (imperatively, like the player's `onTime`) so
 * the modal never re-renders at frame rate.
 */

/** peaks kept in the scrolling live view while recording */
export const LIVE_PEAKS = 200;
/** the live view spreads over at least this many slots, so the first
 *  couple of seconds are drawn wide instead of as a sliver on the left */
export const LIVE_MIN_SLOTS = 45;
/** one live peak is emitted per this many ms of audio */
const PEAK_INTERVAL_MS = 45;
/** discarded before capture starts, so the capture device has settled */
const WARMUP_MS = 250;
/** gain ramp at both ends of the take, seconds */
const FADE_S = 0.06;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ordered by preference; Chrome/Firefox land on webm/opus, Safari on mp4. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export interface RecordResult {
  file: File;
  /** wall-clock recording length, seconds — fallback when decoding fails */
  elapsed: number;
}

type Tick = (peaks: readonly number[], elapsed: number) => void;

export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ac: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private disposed = false;
  private raf = 0;
  private startedAt = 0;
  private lastPeakAt = 0;
  /** max abs level seen since the last emitted peak */
  private bucket = 0;
  private listeners = new Set<Tick>();

  /** rolling window of live peaks, oldest first; at most LIVE_PEAKS entries */
  peaks: number[] = [];
  elapsed = 0;

  onTick(cb: Tick): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Rejects when the mic is unavailable or the user denies permission. */
  async start(): Promise<void> {
    const mimeType = pickMime();
    // The speech DSP Chrome enables by default pumps and gates on music, and
    // its echo canceller emits transients while it converges. Non-`exact`
    // constraints, so a device that can't honour them still opens.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (this.disposed) {
      // cancelled while the permission prompt was up — don't hold the mic open
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    this.chunks = [];
    this.peaks = [];
    this.elapsed = 0;
    this.bucket = 0;

    // Record a gain-ramped copy of the mic rather than the raw track: a
    // freshly opened capture device puts a click in its first frames, and
    // starting from silence keeps it out of the file. Best effort — without
    // Web Audio we fall back to the raw stream and a dark meter.
    let source = this.stream;
    try {
      this.ac = new AudioContext();
      await this.ac.resume();
      const src = this.ac.createMediaStreamSource(this.stream);
      this.gain = this.ac.createGain();
      this.gain.gain.value = 0;
      this.dest = this.ac.createMediaStreamDestination();
      this.analyser = this.ac.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.gain);
      this.gain.connect(this.analyser);
      this.gain.connect(this.dest); // never reaches ac.destination — no monitoring/feedback
      this.data = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      source = this.dest.stream;
    } catch {
      this.analyser = null;
      this.gain = null;
    }

    await wait(WARMUP_MS);
    if (this.disposed) return; // cancelled during the warm-up

    this.rec = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(250); // periodic chunks so a long take isn't one giant buffer
    this.fade(1); // opens from digital silence once the encoder is already running

    this.startedAt = performance.now();
    this.lastPeakAt = this.startedAt;
    this.tick();
  }

  /** Ramps the recorded signal to `to` over FADE_S; no-op without Web Audio. */
  private fade(to: number): void {
    if (!this.ac || !this.gain) return;
    const t0 = this.ac.currentTime;
    this.gain.gain.cancelScheduledValues(t0);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t0);
    this.gain.gain.linearRampToValueAtTime(to, t0 + FADE_S);
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    this.elapsed = (now - this.startedAt) / 1000;

    if (this.analyser && this.data) {
      this.analyser.getByteTimeDomainData(this.data);
      let mx = 0;
      for (let i = 0; i < this.data.length; i++) {
        const v = Math.abs(this.data[i] - 128) / 128;
        if (v > mx) mx = v;
      }
      if (mx > this.bucket) this.bucket = mx;
    }

    if (now - this.lastPeakAt >= PEAK_INTERVAL_MS) {
      this.lastPeakAt = now;
      this.peaks.push(Math.max(0.04, Math.min(1, this.bucket * 1.25)));
      if (this.peaks.length > LIVE_PEAKS) this.peaks.shift();
      this.bucket = 0;
    }

    for (const cb of this.listeners) cb(this.peaks, this.elapsed);
  };

  /** Stops capture and resolves with the encoded take. */
  async stop(): Promise<RecordResult> {
    const rec = this.rec;
    if (!rec) throw new Error("not recording");
    // ramp down before cutting the encoder, so the take doesn't end on a step
    this.fade(0);
    await wait(FADE_S * 1000);
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    if (rec.state !== "inactive") rec.stop();
    await done;
    this.teardown();

    const type = rec.mimeType || "audio/webm";
    const blob = new Blob(this.chunks, { type });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const file = new File([blob], `recording-${stamp}.${extFor(type)}`, { type });
    return { file, elapsed };
  }

  /** Aborts an in-flight take and releases the mic. Safe to call any time. */
  dispose(): void {
    this.disposed = true; // start() may still be inside its warm-up wait
    if (this.rec && this.rec.state !== "inactive") {
      this.rec.onstop = null;
      try {
        this.rec.stop();
      } catch {
        // already stopping — nothing to clean up beyond the teardown below
      }
    }
    this.teardown();
    this.chunks = [];
    this.listeners.clear();
  }

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.dest?.stream.getTracks().forEach((t) => t.stop());
    this.dest = null;
    this.gain?.disconnect();
    this.gain = null;
    this.analyser = null;
    this.data = null;
    void this.ac?.close().catch(() => {});
    this.ac = null;
  }
}
