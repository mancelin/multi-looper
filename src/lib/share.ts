"use client";

import type { Loop, Track } from "@/lib/types";
import { extractVideoId } from "@/lib/youtube";

/**
 * Share links encode one loop of a YouTube track as query params on the app
 * root (`/?share=<videoId>&a=…&b=…&name=…&title=…`). File tracks can't be
 * shared — the media itself never leaves the sender's machine.
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
