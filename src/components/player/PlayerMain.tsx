"use client";

import { useCallback, useEffect, useRef } from "react";
import { firstImageFile, imageFileToDataUrl } from "@/lib/image";
import { player } from "@/lib/player/controller";
import type { Track } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { ImagePanel } from "./ImagePanel";
import { LoopStrip } from "./LoopStrip";
import { LoopTrim } from "./LoopTrim";
import { TrackHeader } from "./TrackHeader";
import { Transport } from "./Transport";
import { VideoPanel } from "./VideoPanel";
import { Waveform } from "./Waveform";

export function PlayerMain({ track }: { track: Track }) {
  const mainRef = useRef<HTMLElement | null>(null);

  // media elements are mounted (refs registered) before this runs
  useEffect(() => {
    player.loadCurrent();
  }, [track.id, track.url]);

  const applyImage = useCallback(
    async (file: File) => {
      try {
        const image = await imageFileToDataUrl(file);
        useLibrary.getState().patchTrack(track.id, { image });
      } catch {
        // undecodable image — ignore
      }
    },
    [track.id],
  );

  // Paste an image anywhere (outside text inputs) to set the track cover.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const file = firstImageFile(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      void applyImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [applyImage]);

  const onDragOver = (e: React.DragEvent) => {
    if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    const file = firstImageFile(e.dataTransfer);
    if (!file) return;
    e.preventDefault();
    void applyImage(file);
  };

  return (
    <main
      ref={mainRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_-10%,#12161d_0%,#0c0e12_60%)]"
    >
      <TrackHeader track={track} />
      <ImagePanel track={track} />
      <VideoPanel track={track} mainRef={mainRef} />
      <Waveform track={track} />
      <Transport track={track} />
      <LoopStrip track={track} />
      <LoopTrim track={track} />
    </main>
  );
}
