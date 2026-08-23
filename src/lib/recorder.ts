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
/** gain ramp at both ends of the take, seconds — long enough to kill the
 *  sample-zero click, short enough that no playing is audibly lost */
const FADE_S = 0.02;
/** subsonic cutoff, Hz — below the lowest note of a 4-string bass (41 Hz), so
 *  it strips rumble, handling thumps and DC offset without touching pitch */
const RUMBLE_HZ = 30;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ordered by preference. Ogg comes first because Firefox's webm output is a
 * live stream — no duration, empty `seekable`, every seek snaps back to 0, so
 * the transport and the A/B shortcuts have nothing to move. Its ogg output
 * carries both. Chrome has no ogg encoder and falls through to webm, which it
 * does write seekably; Safari lands on mp4.
 */
const MIME_CANDIDATES = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
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

/** the encoder never starts until the stream has been open this long, so a
 *  click landing right on the modal opening still misses the mic-open noise */
const MIN_OPEN_MS = 500;

export interface OpenOptions {
  /** run the mic through the browser's speech denoiser (default true) */
  noiseSuppression?: boolean;
}

export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ac: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private hp: BiquadFilterNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  /** what the encoder records: the ramped copy, or the raw mic as a fallback */
  private source: MediaStream | null = null;
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
  private capturing = false;
  private openedAt = 0;

  onTick(cb: Tick): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /**
   * Brings the mic up and leaves it running, muted, with the meter live.
   *
   * This is deliberately not tied to the record button. Opening a capture
   * stream is what makes the noise we keep chasing — a Bluetooth headset beeps
   * as it switches to its headset profile, interfaces pop — so the stream has
   * to be open well before the encoder starts. Held open across takes too, so
   * "record again" never triggers a second profile switch.
   *
   * Rejects when the mic is unavailable or the user denies permission.
   * `noiseSuppression` hands the take to the browser's speech denoiser — good
   * on a noisy room, but it gates quiet note tails, so instrument takes want
   * it off.
   */
  async open({ noiseSuppression = true }: OpenOptions = {}): Promise<void> {
    // The rest of the speech DSP stays off whatever the caller asks for: AGC
    // pumps on dynamics and the echo canceller emits transients while it
    // converges. Non-`exact` constraints, so a device that can't honour them
    // still opens.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, autoGainControl: false, noiseSuppression },
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
    this.capturing = false;

    // Record a gain-ramped copy of the mic rather than the raw track: a
    // freshly opened capture device puts a click in its first frames, and
    // starting from silence keeps it out of the file. Best effort — without
    // Web Audio we fall back to the raw stream and a dark meter.
    let source = this.stream;
    try {
      this.ac = new AudioContext();
      await this.ac.resume();
      const src = this.ac.createMediaStreamSource(this.stream);
      // subsonic rumble carries no signal but eats headroom in the encoder
      this.hp = this.ac.createBiquadFilter();
      this.hp.type = "highpass";
      this.hp.frequency.value = RUMBLE_HZ;
      this.gain = this.ac.createGain();
      this.gain.gain.value = 0;
      this.dest = this.ac.createMediaStreamDestination();
      this.analyser = this.ac.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.hp);
      this.hp.connect(this.analyser); // ahead of the ramp: arming must hear the real input
      this.hp.connect(this.gain);
      this.gain.connect(this.dest); // never reaches ac.destination — no monitoring/feedback
      this.data = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      source = this.dest.stream;
    } catch {
      this.analyser = null;
      this.gain = null;
      this.hp = null;
    }

    this.source = source;
    this.openedAt = performance.now();
    this.lastPeakAt = this.openedAt;
    this.tick(); // meter runs while idle, so the input is visible before arming
  }

  /** True once {@link open} has the mic running. */
  get ready(): boolean {
    return !!this.source;
  }

  /**
   * Starts the encoder on the already-open stream. Nothing is gated and
   * nothing is discarded: by now the mic has been live long enough that its
   * open-noise is over, so the take is clean from its first frame.
   */
  async begin(): Promise<void> {
    if (!this.source) throw new Error("mic not open");
    const since = performance.now() - this.openedAt;
    if (since < MIN_OPEN_MS) await wait(MIN_OPEN_MS - since);
    if (this.disposed || !this.source) return;

    this.chunks = [];
    this.peaks = [];
    this.elapsed = 0;
    this.bucket = 0;

    const mimeType = pickMime();
    this.rec = new MediaRecorder(this.source, mimeType ? { mimeType } : undefined);
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(250); // periodic chunks so a long take isn't one giant buffer

    this.fade(1); // opens from digital silence, so sample zero can't click

    this.capturing = true;
    this.startedAt = performance.now();
    this.lastPeakAt = this.startedAt;
  }


  /** Peak of the current analyser frame, 0–1. */
  private level(): number {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let mx = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = Math.abs(this.data[i] - 128) / 128;
      if (v > mx) mx = v;
    }
    return mx;
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
    this.elapsed = this.capturing ? (now - this.startedAt) / 1000 : 0;

    const mx = this.level();
    if (mx > this.bucket) this.bucket = mx;

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
    this.rec = null;
    this.capturing = false;
    this.peaks = []; // the idle meter starts clean for the next take
    // the mic stays open: reopening it is exactly what makes the noise this
    // whole arrangement exists to avoid, so the next take reuses this stream

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
    this.source = null;
    this.gain?.disconnect();
    this.gain = null;
    this.hp?.disconnect();
    this.hp = null;
    this.analyser = null;
    this.data = null;
    void this.ac?.close().catch(() => {});
    this.ac = null;
  }
}
