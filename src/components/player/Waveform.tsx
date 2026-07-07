"use client";

import { useCallback, useEffect, useRef } from "react";
import { player } from "@/lib/player/controller";
import { fmtS } from "@/lib/time";
import { activeLoop, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";

export function Waveform({ track }: { track: Track }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const patchActiveLoop = useLibrary((s) => s.patchActiveLoop);

  const lp = activeLoop(track);
  const d = track.duration || 1;
  const aPct = (lp.a / d) * 100;
  const bPct = (lp.b / d) * 100;

  const draw = useCallback(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (W < 2 || H < 2) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const peaks = track.peaks ?? [];
    const n = peaks.length;
    if (!n) return;
    const aX = (lp.a / d) * W;
    const bX = (lp.b / d) * W;
    const bw = W / n;
    const mid = H / 2;
    for (let i = 0; i < n; i++) {
      const h = Math.max(1.5, peaks[i] * (H * 0.86));
      const x = i * bw;
      const cx = x + bw * 0.31;
      g.fillStyle = cx >= aX && cx <= bX ? track.accent : "#39414f";
      g.fillRect(x, mid - h / 2, Math.max(1, bw * 0.62), h);
    }
  }, [track.peaks, track.accent, lp.a, lp.b, d]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(
    () =>
      player.onTime((t, dur) => {
        const p = Math.max(0, Math.min(1, t / dur));
        if (playheadRef.current) playheadRef.current.style.left = `${p * 100}%`;
      }),
    [],
  );

  // keep the playhead in place across track/loop changes without waiting for a tick
  useEffect(() => {
    const p = Math.max(0, Math.min(1, player.getT() / d));
    if (playheadRef.current) playheadRef.current.style.left = `${p * 100}%`;
  }, [track.id, d]);

  const pctFromEvent = (e: { clientX: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };

  const startDrag = (which: "A" | "B", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const t = pctFromEvent(ev) * d;
      // read the freshest loop bounds for clamping while dragging
      const cur = useLibrary.getState();
      const c = cur.tracks.find((x) => x.id === cur.currentId);
      const l = c ? activeLoop(c) : lp;
      if (which === "A") patchActiveLoop({ a: Math.max(0, Math.min(t, l.b - 0.05)) });
      else patchActiveLoop({ b: Math.max(l.a + 0.05, Math.min(t, d)) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nTicks = 6;
  const ticks = Array.from({ length: nTicks + 1 }, (_, i) => ({
    left: `${(i / nTicks) * 100}%`,
    label: fmtS((i / nTicks) * d),
  }));

  return (
    <div className="flex flex-none flex-col px-4 pt-[6px] sm:px-[26px]">
      <div
        ref={wrapRef}
        onPointerDown={(e) => player.setT(pctFromEvent(e) * d)}
        className="relative h-[132px] flex-none cursor-text overflow-hidden rounded-[12px] border border-white/7 bg-panel-2"
      >
        {/* loop region */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-1 border-x-[1.5px] border-[rgba(94,234,212,.55)] bg-[rgba(94,234,212,.09)]"
          style={{ left: `${aPct}%`, width: `${bPct - aPct}%` }}
        />
        {/* outside dim */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 top-0 z-1 bg-[rgba(6,8,11,.5)]"
          style={{ width: `${aPct}%` }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 top-0 z-1 bg-[rgba(6,8,11,.5)]"
          style={{ left: `${bPct}%` }}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-2 h-full w-full" />
        {/* A handle */}
        <div
          onPointerDown={(e) => startDrag("A", e)}
          className="absolute bottom-0 top-0 z-5 w-[14px] -translate-x-1/2 cursor-ew-resize touch-none"
          style={{ left: `${aPct}%` }}
        >
          <div className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-accent" />
          <div className="absolute left-1/2 top-[6px] -translate-x-1/2 rounded-[4px] bg-accent px-[5px] py-[2px] text-[9px] font-bold text-on-accent">
            A
          </div>
        </div>
        {/* B handle */}
        <div
          onPointerDown={(e) => startDrag("B", e)}
          className="absolute bottom-0 top-0 z-5 w-[14px] -translate-x-1/2 cursor-ew-resize touch-none"
          style={{ left: `${bPct}%` }}
        >
          <div className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-accent" />
          <div className="absolute left-1/2 top-[6px] -translate-x-1/2 rounded-[4px] bg-accent px-[5px] py-[2px] text-[9px] font-bold text-on-accent">
            B
          </div>
        </div>
        {/* playhead */}
        <div
          ref={playheadRef}
          className="pointer-events-none absolute bottom-0 top-0 z-6 w-[2px] bg-playhead shadow-[0_0_8px_rgba(255,180,84,.6)]"
        >
          <div className="absolute -top-[1px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-playhead" />
        </div>
      </div>

      {/* ruler */}
      <div className="relative mt-[5px] h-[22px] flex-none">
        {ticks.map((tk, i) => (
          <div
            key={i}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-[2px]"
            style={{ left: tk.left }}
          >
            <div className="h-1 w-px bg-white/14" />
            <span className="tno text-[10px] text-muted-4">{tk.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
