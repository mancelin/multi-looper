"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicIcon, PauseIcon, PlayIcon, StopIcon } from "@/components/icons";
import { decodePeaks } from "@/lib/peaks";
import { player } from "@/lib/player/controller";
import { LIVE_MIN_SLOTS, LIVE_PEAKS, Recorder, recordingSupported } from "@/lib/recorder";
import { fmt } from "@/lib/time";
import { ACCENTS } from "@/lib/types";
import { addRecording } from "@/store/ingest";
import { useUi } from "@/store/ui";

export function RecordModal() {
  const open = useUi((s) => s.recordOpen);
  if (!open) return null;
  return <RecordModalContent />;
}

type Phase = "idle" | "recording" | "review";

interface Take {
  file: File;
  peaks: number[];
  duration: number;
  url: string;
}

/** Paints `peaks` across the canvas, accented up to `progress` (0–1). */
function paint(cv: HTMLCanvasElement, peaks: readonly number[], slots: number, progress: number) {
  const W = cv.clientWidth;
  const H = cv.clientHeight;
  if (W < 2 || H < 2) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const g = cv.getContext("2d");
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const bw = W / slots;
  const mid = H / 2;
  const cut = progress * W;
  for (let i = 0; i < peaks.length; i++) {
    const h = Math.max(1.5, peaks[i] * (H * 0.86));
    const x = i * bw;
    g.fillStyle = x + bw * 0.31 <= cut ? ACCENTS.recording : "#39414f";
    g.fillRect(x, mid - h / 2, Math.max(1, bw * 0.62), h);
  }
}

/** Mounted only while open, so recorder/take state starts fresh each time. */
function RecordModalContent() {
  const setOpen = useUi((s) => s.setRecordOpen);
  const pushToast = useUi((s) => s.pushToast);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [take, setTake] = useState<Take | null>(null);
  const [name, setName] = useState("");
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [busy, setBusy] = useState(false);

  const recRef = useRef<Recorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const takeRef = useRef<Take | null>(null);

  const supported = recordingSupported();

  // mirrored into a ref so the unmount cleanup below can revoke the live take
  useEffect(() => {
    takeRef.current = take;
  }, [take]);

  // the mic and the app transport must not run at once
  useEffect(() => {
    player.pause();
  }, []);

  // release the mic and the preview object URL whatever way the modal goes away
  useEffect(
    () => () => {
      recRef.current?.dispose();
      recRef.current = null;
      if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
    },
    [],
  );

  const startRecording = async () => {
    setError("");
    if (!supported) {
      setError("Recording isn't supported in this browser.");
      return;
    }
    const rec = new Recorder();
    recRef.current = rec;
    setBusy(true); // permission prompt + mic warm-up happen before the first frame
    try {
      await rec.start();
    } catch (e) {
      recRef.current = null;
      rec.dispose();
      const code = e instanceof DOMException ? e.name : "";
      setError(
        code === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser, then try again."
          : code === "NotFoundError"
            ? "No microphone found."
            : `Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    } finally {
      setBusy(false);
    }
    if (recRef.current !== rec) return; // cancelled while warming up
    // live meter is driven imperatively — no React render per frame
    rec.onTick((peaks, elapsed) => {
      if (canvasRef.current) {
        // widen the slots while the window is still filling, then let it scroll
        const slots = Math.min(LIVE_PEAKS, Math.max(peaks.length, LIVE_MIN_SLOTS));
        paint(canvasRef.current, peaks, slots, 1);
      }
      if (clockRef.current) clockRef.current.textContent = fmt(elapsed);
    });
    setPhase("recording");
  };

  const stopRecording = async () => {
    const rec = recRef.current;
    if (!rec) return;
    setBusy(true);
    try {
      const { file, elapsed } = await rec.stop();
      recRef.current = null;
      const { peaks, duration } = await decodePeaks(file);
      const dur = duration || elapsed || 1; // 0 = decode failed; wall clock is close enough
      setTake({ file, peaks, duration: dur, url: URL.createObjectURL(file) });
      setName(`Recording ${new Date().toLocaleTimeString()}`);
      setPhase("review");
    } catch (e) {
      setError(`Couldn't finish the recording: ${e instanceof Error ? e.message : String(e)}`);
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  };

  const redo = () => {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setPreviewPlaying(false);
    setPhase("idle");
  };

  const close = () => {
    recRef.current?.dispose();
    recRef.current = null;
    setOpen(false);
  };

  const save = () => {
    if (!take) return;
    addRecording(take.file, name, take.peaks, take.duration);
    URL.revokeObjectURL(take.url); // addRecording mints its own URL for the track
    setTake(null);
    pushToast("Recording added to your library");
    setOpen(false);
  };

  // going back to idle (Record again, or a failed stop) must not leave the
  // previous take painted under the hint text
  useEffect(() => {
    if (phase !== "idle") return;
    const cv = canvasRef.current;
    const g = cv?.getContext("2d");
    if (cv && g) g.clearRect(0, 0, cv.width, cv.height);
    if (clockRef.current) clockRef.current.textContent = fmt(0);
  }, [phase]);

  // review waveform: repaint on take change, resize, and every preview frame
  const repaintPreview = useCallback(() => {
    const cv = canvasRef.current;
    const t = take;
    if (!cv || !t) return;
    const at = audioRef.current?.currentTime ?? 0;
    const p = Math.max(0, Math.min(1, at / t.duration));
    paint(cv, t.peaks, t.peaks.length, p);
    if (headRef.current) headRef.current.style.left = `${p * 100}%`;
    if (clockRef.current) clockRef.current.textContent = fmt(at);
  }, [take]);

  useEffect(() => {
    if (phase !== "review") return;
    repaintPreview();
    const ro = new ResizeObserver(repaintPreview);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [phase, take, repaintPreview]);

  useEffect(() => {
    if (!previewPlaying) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      repaintPreview();
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [previewPlaying, repaintPreview]);

  const togglePreview = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPreviewPlaying(false));
    else el.pause();
  };

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !take) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    el.currentTime = p * take.duration;
    repaintPreview();
  };

  // Escape closes the modal; the global player shortcuts are suppressed while
  // it is open (see ShortcutsProvider) so space drives the preview, not the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      const tag = ((e.target as HTMLElement)?.tagName || "").toLowerCase();
      if (e.key === " " && phase === "review" && tag !== "input") {
        e.preventDefault();
        togglePreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        data-testid="record-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-[min(560px,100%)] rounded-[16px] border border-white/10 bg-raised px-[26px] py-6 shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[rgba(253,186,116,.25)] bg-[rgba(253,186,116,.1)] text-[#fdba74]">
              <MicIcon size={17} />
            </span>
            <h2 className="m-0 text-[17px] font-semibold">Record a track</h2>
          </div>
          <button
            onClick={close}
            data-testid="record-close"
            className="h-[30px] w-[30px] cursor-pointer rounded-[8px] border border-white/10 bg-field-2 text-muted"
          >
            ✕
          </button>
        </div>

        {/* waveform: live meter while recording, decoded take while reviewing */}
        <div
          onPointerDown={phase === "review" ? seek : undefined}
          data-testid="record-waveform"
          className={`relative h-[132px] overflow-hidden rounded-[12px] border border-white/7 bg-panel-2 ${
            phase === "review" ? "cursor-text" : ""
          }`}
        >
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {phase === "idle" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-[8px] border border-white/8 bg-[rgba(6,8,11,.85)] px-3 py-[7px] text-[13px] text-ink">
                Hit record and play — the take lands in your library.
              </span>
            </div>
          )}
          {phase === "review" && (
            <div
              ref={headRef}
              className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-playhead shadow-[0_0_8px_rgba(255,180,84,.6)]"
            >
              <div className="absolute -top-[1px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-playhead" />
            </div>
          )}
          {phase === "recording" && (
            <span className="absolute left-3 top-3 flex items-center gap-[7px] rounded-[6px] bg-[rgba(6,8,11,.85)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[.08em] text-danger">
              <span className="h-[7px] w-[7px] rounded-full bg-danger [animation:eq_1.1s_ease-in-out_infinite]" />
              Rec
            </span>
          )}
        </div>

        <div className="mt-[10px] flex items-center justify-between">
          <span ref={clockRef} data-testid="record-time" className="tno text-[13px] text-muted">
            {fmt(0)}
          </span>
          {phase === "review" && take && (
            <span className="tno text-[12px] text-muted-4">{fmt(take.duration)}</span>
          )}
        </div>

        {take && (
          <audio
            ref={audioRef}
            src={take.url}
            preload="auto"
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
            onEnded={() => setPreviewPlaying(false)}
            className="hidden"
          />
        )}

        {phase === "review" && (
          <input
            data-testid="record-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recording name"
            className="mt-3 h-10 w-full rounded-[9px] border border-white/9 bg-field px-[11px] text-[13px] text-ink"
          />
        )}

        <div className="mt-[18px] flex flex-wrap items-center gap-2">
          {phase === "idle" && (
            <button
              onClick={() => void startRecording()}
              data-testid="record-start"
              disabled={busy}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-[9px] bg-danger px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              <MicIcon size={16} />
              Start recording
            </button>
          )}
          {phase === "recording" && (
            <button
              onClick={() => void stopRecording()}
              data-testid="record-stop"
              disabled={busy}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-[9px] border border-white/12 bg-field-2 px-4 text-[13px] font-semibold text-ink disabled:opacity-50"
            >
              <StopIcon size={13} />
              Stop
            </button>
          )}
          {phase === "review" && (
            <>
              <button
                onClick={togglePreview}
                data-testid="record-play"
                aria-label={previewPlaying ? "Pause preview" : "Play preview"}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[9px] bg-accent text-on-accent"
              >
                {previewPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
              </button>
              <button
                onClick={redo}
                data-testid="record-again"
                className="flex h-10 cursor-pointer items-center gap-2 rounded-[9px] border border-white/12 bg-field-2 px-4 text-[13px] font-medium text-muted"
              >
                <MicIcon size={15} />
                Record again
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={close}
              data-testid="record-cancel"
              className="h-10 cursor-pointer rounded-[9px] border border-white/12 bg-field-2 px-4 text-[13px] font-medium text-muted"
            >
              Cancel
            </button>
            <button
              onClick={save}
              data-testid="record-save"
              disabled={phase !== "review" || !take}
              className="h-10 cursor-pointer rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>

        {error && <p className="mb-0 mt-3 text-[12.5px] text-danger">{error}</p>}
      </div>
    </div>
  );
}
