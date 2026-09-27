"use client";

import { player } from "@/lib/player/controller";
import type { ExtraMedia, ExtraMediaSegment, Track } from "@/lib/types";
import { currentTrack, useLibrary } from "@/store/library";
import {
  fullSpan,
  mergeSegment,
  moveBoundary,
  segmentAt,
  splitAt,
} from "./extraMedia";

/**
 * Store-bound extra-media segment operations, shared by the panel and the
 * times menu - the counterpart to `loopEdit.ts`. Components go through these
 * rather than writing `extraMedia` themselves, so the partition invariants
 * live in one place.
 */

function ctx(trackId?: string) {
  const s = useLibrary.getState();
  const track = trackId ? s.tracks.find((t) => t.id === trackId) : currentTrack(s);
  return track ? { s, track } : null;
}

function apply(trackId: string, segs: ExtraMediaSegment[] | undefined): void {
  useLibrary.getState().patchTrack(trackId, { extraMedia: segs?.length ? segs : undefined });
}

/** The segment showing right now, at the playhead. */
export function activeSegment(track: Track): ExtraMediaSegment | undefined {
  return segmentAt(track.extraMedia, player.getT());
}

/**
 * Give a segment its media. With no segments yet the first one is created
 * spanning the whole track - that is what "extra media covers the whole
 * track by default" means.
 */
export function setSegmentMedia(trackId: string, segId: string | null, media: ExtraMedia): void {
  const c = ctx(trackId);
  if (!c) return;
  const segs = c.track.extraMedia;
  if (!segs?.length) {
    apply(trackId, fullSpan(c.track.duration, media));
    return;
  }
  const id = segId ?? activeSegment(c.track)?.id;
  apply(
    trackId,
    segs.map((s) => (s.id === id ? { ...s, media } : s)),
  );
}

/**
 * Take a segment's media away. The last remaining segment goes with it -
 * an empty partition and one empty segment look the same, and no extra media
 * at all is the honest state.
 */
export function clearSegmentMedia(trackId: string, segId: string): void {
  const c = ctx(trackId);
  const segs = c?.track.extraMedia;
  if (!segs?.length) return;
  if (segs.length === 1) {
    apply(trackId, undefined);
    return;
  }
  apply(
    trackId,
    segs.map((s) => (s.id === segId ? { ...s, media: undefined } : s)),
  );
}

/**
 * The id of the segment to edit, creating the full-track one when the track
 * has no extra media yet - the notes editor needs something to attach to
 * before the user has typed anything.
 */
export function ensureSegment(trackId: string): string | null {
  const c = ctx(trackId);
  if (!c) return null;
  const existing = activeSegment(c.track) ?? c.track.extraMedia?.[0];
  if (existing) return existing.id;
  const segs = fullSpan(c.track.duration);
  apply(trackId, segs);
  return segs[0].id;
}

/** Carve the segment under the playhead in two; the new half starts empty. */
export function splitAtPlayhead(trackId: string): void {
  const c = ctx(trackId);
  const segs = c?.track.extraMedia;
  if (!segs?.length) return;
  apply(trackId, splitAt(segs, player.getT()));
}

export function moveSegmentBoundary(trackId: string, index: number, t: number): void {
  const c = ctx(trackId);
  const segs = c?.track.extraMedia;
  if (!segs?.length) return;
  apply(trackId, moveBoundary(segs, index, t));
}

/** Nudge one end of a segment, which is the same as moving its shared edge. */
export function nudgeSegmentEdge(
  trackId: string,
  segId: string,
  edge: "start" | "end",
  delta: number,
): void {
  const c = ctx(trackId);
  const segs = c?.track.extraMedia;
  if (!segs?.length) return;
  const i = segs.findIndex((s) => s.id === segId);
  if (i < 0) return;
  // the outer ends are pinned to the track, so only inner edges can move
  const b = edge === "start" ? i - 1 : i;
  if (b < 0 || b > segs.length - 2) return;
  apply(trackId, moveBoundary(segs, b, (edge === "start" ? segs[i].start : segs[i].end) + delta));
}

export function removeSegment(trackId: string, segId: string): void {
  const c = ctx(trackId);
  const segs = c?.track.extraMedia;
  if (!segs?.length) return;
  apply(trackId, mergeSegment(segs, segId));
}

/** Selecting a segment seeks to it, the way selecting a loop does. */
export function seekToSegment(seg: ExtraMediaSegment): void {
  player.setT(seg.start);
}
