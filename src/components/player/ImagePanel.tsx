"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, ResizeIcon } from "@/components/icons";
import { clearImageHeights, loadImageHeight, saveImageHeight } from "@/lib/imageSize";
import type { Track } from "@/lib/types";
import { useLibrary } from "@/store/library";

const MIN_HEIGHT = 72;

/**
 * Cover image for file tracks, shown above the waveform. Fills the leftover
 * column height by default; dragging the corner grip sets a fixed height
 * (width follows to keep the aspect ratio), remembered per track until the
 * window is resized — a window resize resets every track back to auto-fit.
 */
export function ImagePanel({ track }: { track: Track }) {
  const patchTrack = useLibrary((s) => s.patchTrack);
  const boxRef = useRef<HTMLDivElement>(null);
  const [sized, setSized] = useState<{ id: string; height: number | null }>(() => ({
    id: track.id,
    height: loadImageHeight(track.id),
  }));
  // Reset during render when the track changes (avoids a one-frame flash of
  // the previous track's height that an effect-based reset would show).
  if (sized.id !== track.id) {
    setSized({ id: track.id, height: loadImageHeight(track.id) });
  }
  const height = sized.id === track.id ? sized.height : loadImageHeight(track.id);
  const setHeight = (h: number | null) => setSized({ id: track.id, height: h });

  useEffect(() => {
    const onResize = () => {
      clearImageHeights();
      setSized((s) => ({ ...s, height: null }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (track.kind !== "file" || !track.image) return null;

  const onResizeGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    const startY = e.clientY;
    const startH = boxRef.current?.getBoundingClientRect().height ?? MIN_HEIGHT;
    const maxH = Math.round(window.innerHeight * 0.8);
    let h = startH;
    const move = (ev: PointerEvent) => {
      h = Math.max(MIN_HEIGHT, Math.min(maxH, Math.round(startH + (ev.clientY - startY))));
      setHeight(h);
    };
    const up = () => {
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {}
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      saveImageHeight(track.id, h);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`flex items-center justify-center px-4 pb-1 pt-[6px] sm:px-[26px] ${
        height === null ? "min-h-[84px] flex-1" : "flex-none"
      }`}
    >
      <div
        ref={boxRef}
        style={height !== null ? { height } : undefined}
        className="group relative h-full max-w-full overflow-hidden rounded-[12px] border border-white/8 bg-black shadow-[0_8px_30px_rgba(0,0,0,.4)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.image}
          alt=""
          data-testid="track-image"
          className="block h-full w-auto max-w-full object-contain"
        />
        <button
          onClick={() => patchTrack(track.id, { image: undefined })}
          title="Remove image"
          className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[7px] border border-white/10 bg-[rgba(6,8,11,.65)] text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          <CloseIcon size={11} strokeWidth={1.8} />
        </button>
        <div
          onPointerDown={onResizeGrip}
          title="Drag to resize"
          data-testid="image-resize-grip"
          className="absolute bottom-0 right-0 z-6 flex h-6 w-6 cursor-nwse-resize touch-none items-end justify-end rounded-br-[12px] bg-[linear-gradient(135deg,transparent_45%,rgba(0,0,0,.55))] p-1 text-white/70 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ResizeIcon />
        </div>
      </div>
    </div>
  );
}
