"use client";

import { useEffect, useRef } from "react";
import { player } from "@/lib/player/controller";
import type { Track } from "@/lib/types";
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

  return (
    <main
      ref={mainRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_-10%,#12161d_0%,#0c0e12_60%)]"
    >
      <TrackHeader track={track} />
      <VideoPanel track={track} mainRef={mainRef} />
      <Waveform track={track} />
      <Transport track={track} />
      <LoopStrip track={track} />
      <LoopTrim track={track} />
    </main>
  );
}
