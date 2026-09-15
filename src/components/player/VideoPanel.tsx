"use client";

import { useCallback, useEffect, useRef } from "react";
import { PlayIcon, ResizeIcon } from "@/components/icons";
import { player } from "@/lib/player/controller";
import type { Track } from "@/lib/types";
import { useUi } from "@/store/ui";

/** Once the user resizes manually, auto-fit stays off until reload (prototype behavior). */
let manualVideo = false;

// Stable ref callbacks: an inline `(el) => player.setYtHost(el)` gets a new
// identity every render, so React detaches (null) and re-attaches the ref on
// each re-render — and setYtHost(null) destroys the live YouTube player.
const ytHostRef = (el: HTMLDivElement | null) => player.setYtHost(el);

// YouTube flashes its chrome (title bar, share/watch-later, "More videos",
// logo) inside the iframe on every seek — including our loop-restart seeks —
// and none of it can be styled or disabled from outside. The host is made
// taller than the visible box: a 16:9 video letterboxes inside the taller
// iframe, so the chrome anchored to the iframe's top/bottom edges renders in
// the letterbox strips, which the box's overflow-hidden crops away. The video
// itself stays uncropped.
//
// The chrome piece that survives cropping — the center play/pause control —
// can't be cropped or covered without hiding the video under it. Instead the
// iframe renders oversized and is CSS-scaled back down: the video ends up at
// its normal size while YouTube's fixed-pixel chrome shrinks by the same
// factor, leaving the center control a faint speck. The scale is pushed as
// high as the box width allows while keeping the iframe's internal width
// under the GPU's texture limit (probed via WebGL; conservative fallback),
// capped at 16x — beyond that the speck is already sub-4px.
let ytWidthBudget = 7680;
if (typeof window !== "undefined") {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const max = gl?.getParameter(gl.MAX_TEXTURE_SIZE);
    if (typeof max === "number" && max >= 8192) {
      ytWidthBudget = Math.min(15360, max - 1024);
    }
  } catch {}
}
function ytScaleFor(boxWidth: number): number {
  return Math.max(3, Math.min(16, Math.floor(ytWidthBudget / (boxWidth || 620))));
}

// Visual px cut off top/bottom: YouTube's title block is ~80px in iframe
// coordinates at any player size, so scaled down it needs ~96/scale.
function ytCropFor(scale: number): number {
  return Math.ceil(96 / scale);
}

// Firefox refuses to let backdrop-filter sample cross-origin iframe content
// (privacy), so the speck-erasing disc gets no pixels to blur there. Fallback:
// -moz-element() paints a live mirror of the player as the disc's own
// background — aligned 1:1 with what's beneath and blurred via filter, which
// looks identical to the backdrop-filter path.
const MOZ_MIRROR =
  typeof CSS !== "undefined" && CSS.supports("background-image", "-moz-element(#a)");

// diameter of the speck-erasing disc at the video center
const DISC = 16;
const videoElRef = (el: HTMLVideoElement | null) => player.setVideoEl(el);

export function VideoPanel({
  track,
  mainRef,
}: {
  track: Track;
  mainRef: React.RefObject<HTMLElement | null>;
}) {
  const videoWidth = useUi((s) => s.videoWidth);
  const setVideoWidth = useUi((s) => s.setVideoWidth);
  // real IFrame player state, not transport intent: the cover must stay up
  // while the video is cued/unstarted/ended even if the transport says
  // "playing" — YouTube shows its overlay UI in those states and there is no
  // frame of ours underneath. A pause keeps the surface live so the current
  // frame stays visible.
  const ytLive = useUi((s) => s.ytSurfaceLive);
  const ytScale = ytScaleFor(videoWidth);
  const ytCrop = ytCropFor(ytScale);
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
      const overflow = main.scrollHeight - main.clientHeight;
      // scrollHeight never reports spare room, so when the content fits, measure
      // it: the column packs from the top, so whatever the children don't use
      // between the first one's top and the last one's bottom is free.
      const kids = main.children;
      const packed = kids.length
        ? kids[kids.length - 1].getBoundingClientRect().bottom -
          kids[0].getBoundingClientRect().top
        : 0;
      const spare = main.clientHeight - packed;
      const delta = overflow > 0 ? -overflow : Math.max(0, spare);
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
      className="flex-none items-center justify-center px-4 pb-1 pt-[6px] sm:px-[26px]"
      style={{ display: showPanel ? "flex" : "none" }}
    >
      <div
        ref={boxRef}
        className="relative aspect-video max-w-full overflow-hidden rounded-[12px] border border-white/8 bg-black shadow-[0_8px_30px_rgba(0,0,0,.4)]"
        style={{ width: videoWidth }}
      >
        <div
          className="absolute left-0 origin-top-left"
          style={{
            top: -ytCrop,
            width: `${ytScale * 100}%`,
            height: `calc(${ytScale * 100}% + ${ytScale * 2 * ytCrop}px)`,
            transform: `scale(${1 / ytScale})`,
            display: track.kind === "youtube" ? "block" : "none",
          }}
        >
          <div ref={ytHostRef} id="yt-mirror-src" className="h-full w-full" />
        </div>
        <video
          ref={videoElRef}
          playsInline
          onLoadedMetadata={() => player.onLoadedMetadata()}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          style={{ display: track.kind === "file" ? "block" : "none" }}
        />
        {/* What's left of YouTube's center play/pause control after the
            scale-down is a ~4px speck. This disc blurs the pixels beneath it,
            smearing the speck into the surrounding video — optically gone,
            while the video merely gets an imperceptible soft spot. */}
        {track.kind === "youtube" && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: DISC,
              height: DISC,
              ...(MOZ_MIRROR
                ? {
                    // mirror of the player aligned 1:1 behind the disc; box
                    // height follows from the aspect-video ratio
                    background: `-moz-element(#yt-mirror-src) ${-(videoWidth / 2 - DISC / 2)}px ${-((videoWidth * 9) / 32 - DISC / 2 + ytCrop)}px no-repeat`,
                    backgroundSize: `${videoWidth}px ${(videoWidth * 9) / 16 + 2 * ytCrop}px`,
                    filter: "blur(5px)",
                  }
                : { backdropFilter: "blur(5px)" }),
            }}
          />
        )}
        {/* YouTube's cued/ended UI (title bar, share, "More videos", big play
            button) renders inside the iframe and can't be styled away, so an
            opaque poster covers the iframe until playback starts. */}
        {track.kind === "youtube" && (
          <div
            aria-hidden
            data-testid="yt-cover"
            className="pointer-events-none absolute inset-0 z-3 flex items-center justify-center bg-black transition-opacity duration-200"
            style={{ opacity: ytLive ? 0 : 1 }}
          >
            {track.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.thumb}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            )}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white">
              <PlayIcon size={26} />
            </div>
          </div>
        )}
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
