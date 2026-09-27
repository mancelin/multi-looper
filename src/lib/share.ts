"use client";

import { ACCENTS, uid, type Loop, type Track } from "@/lib/types";
import { extractVideoId, syntheticYtPeaks, thumbUrl } from "@/lib/youtube";
import { useLibrary } from "@/store/library";

/**
 * Share links encode one loop of a YouTube track as query params on the app
 * root (`/?share=<videoId>&a=…&b=…&name=…&title=…`). File tracks can't be
 * shared - the media itself never leaves the sender's machine.
 */

export interface SharedLoop {
  videoId: string;
  a: number;
  b: number;
  name?: string;
  title?: string;
}

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Share URL for one loop, or null for non-YouTube tracks. */
export function buildShareUrl(origin: string, track: Track, loop: Loop): string | null {
  if (track.kind !== "youtube" || !track.videoId) return null;
  const p = new URLSearchParams({ share: track.videoId, a: fmt(loop.a), b: fmt(loop.b) });
  if (loop.name.trim()) p.set("name", loop.name.trim());
  if (track.title.trim()) p.set("title", track.title.trim());
  return `${origin}/?${p.toString()}`;
}

/** Parse a share link's query string; null when absent or invalid. */
export function parseShareParams(search: string): SharedLoop | null {
  const p = new URLSearchParams(search);
  const videoId = extractVideoId(p.get("share") ?? "");
  if (!videoId) return null;
  const a = Number(p.get("a"));
  const b = Number(p.get("b"));
  // same 0.05s minimum gap as loopEdit.ts
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a + 0.05) return null;
  return {
    videoId,
    a,
    b,
    name: p.get("name")?.trim() || undefined,
    title: p.get("title")?.trim() || undefined,
  };
}

/**
 * Apply a share link at boot, after the library has been restored: add the
 * shared loop to the existing track for that video, or import the video as a
 * new track whose only loop is the shared one. `startUrlSync()` runs right
 * after and rewrites the URL to the selected track, dropping the consumed
 * query params. Invalid links are ignored.
 */
export function consumeShareLink(): void {
  const shared = parseShareParams(window.location.search);
  if (!shared) return;
  const lib = useLibrary.getState();
  const existing = lib.tracks.find((t) => t.kind === "youtube" && t.videoId === shared.videoId);

  if (existing) {
    const a = Math.max(0, Math.min(shared.a, existing.duration - 0.05));
    const b = Math.min(shared.b, existing.duration);
    if (b < a + 0.05) return;
    const loop: Loop = {
      id: uid("l"),
      name: shared.name ?? `Loop ${existing.loops.length + 1}`,
      a,
      b,
    };
    lib.patchTrack(existing.id, {
      loops: [...existing.loops, loop].sort((x, y) => x.a - y.a),
      activeLoopId: loop.id,
    });
    lib.selectTrack(existing.id);
    return;
  }

  const loop: Loop = { id: uid("l"), name: shared.name ?? "Loop 1", a: shared.a, b: shared.b };
  const track: Track = {
    id: uid("y"),
    kind: "youtube",
    videoId: shared.videoId,
    title: shared.title ?? "YouTube loop",
    artist: "youtube.com",
    tags: ["youtube"],
    // placeholder like ingest (patched from the IFrame player once ready),
    // stretched to keep the shared loop in range
    duration: Math.max(210, shared.b),
    loops: [loop],
    activeLoopId: loop.id,
    accent: ACCENTS.youtube,
    thumb: thumbUrl(shared.videoId),
    peaks: syntheticYtPeaks(shared.videoId),
  };
  lib.addTracks([track]);
}
