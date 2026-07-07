"use client";

import { useCallback, useEffect, useRef } from "react";
import { ResizeIcon } from "@/components/icons";
import { player } from "@/lib/player/controller";
import type { Track } from "@/lib/types";
import { useUi } from "@/store/ui";

/** Once the user resizes manually, auto-fit stays off until reload (prototype behavior). */
let manualVideo = false;

export function VideoPanel({
  track,
  mainRef,
}: {
  track: Track;
  mainRef: React.RefObject<HTMLElement | null>;
}) {
  const videoWidth = useUi((s) => s.videoWidth);
  const setVideoWidth = useUi((s) => s.setVideoWidth);
  const boxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showPanel = track.kind === "youtube" || (track.kind === "file" && track.hasVideo && !!track.url);

  const fitVideo = useCallback(() => {
    if (manualVideo) return;
    const box = boxRef.current;
    const main = mainRef.current;
    const container = containerRef.current;
    if (!box || !main || !container) return;
    const cw = container.clientWidth;
    if (cw < 10) return;
    let w = useUi.getState().videoWidth || 620;
    for (let pass = 0; pass < 3; pass++) {
      const curH = box.getBoundingClientRect().height || (w * 9) / 16;
      const delta = main.clientHeight - main.scrollHeight; // >0 spare room, <0 overflow
      const newH = Math.max(150, curH + delta);
      w = Math.max(240, Math.min(cw, Math.floor((newH * 16) / 9)));
      box.style.width = `${w}px`; // apply for the next measurement pass
    }
    if (Math.abs(w - (useUi.getState().videoWidth || 0)) > 1) setVideoWidth(w);
  }, [mainRef, setVideoWidth]);

  useEffect(() => {
    if (!showPanel) return;
    const t1 = setTimeout(fitVideo, 0);
    const t2 = setTimeout(fitVideo, 300);
    window.addEventListener("resize", fitVideo);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fitVideo);
    };
  }, [showPanel, track.id, fitVideo]);

  const onResizeGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    const parent = containerRef.current;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const move = (ev: PointerEvent) => {
      const w = Math.max(280, Math.min(rect.width, Math.round(2 * (ev.clientX - centerX))));
      manualVideo = true;
      setVideoWidth(w);
    };
    const up = () => {
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {}
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={containerRef}
      className="flex-none items-center justify-center px-[26px] pb-1 pt-[6px]"
      style={{ display: showPanel ? "flex" : "none" }}
    >
      <div
        ref={boxRef}
        className="relative aspect-video max-w-full overflow-hidden rounded-[12px] border border-white/8 bg-black shadow-[0_8px_30px_rgba(0,0,0,.4)]"
        style={{ width: videoWidth }}
      >
        <div
          ref={(el) => player.setYtHost(el)}
          className="absolute inset-0"
          style={{ display: track.kind === "youtube" ? "block" : "none" }}
        />
        <video
          ref={(el) => player.setVideoEl(el)}
          playsInline
          onLoadedMetadata={() => player.onLoadedMetadata()}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          style={{ display: track.kind === "file" ? "block" : "none" }}
        />
        <div
          onClick={() => player.togglePlay()}
          title="Click to play / pause"
          className="absolute inset-0 z-4 cursor-pointer"
        />
        <div
          onPointerDown={onResizeGrip}
          title="Drag to resize"
          className="absolute bottom-0 right-0 z-6 flex h-6 w-6 cursor-nwse-resize items-end justify-end rounded-br-[12px] bg-[linear-gradient(135deg,transparent_45%,rgba(0,0,0,.55))] p-1 text-white/70"
        >
          <ResizeIcon />
        </div>
      </div>
    </div>
  );
}
