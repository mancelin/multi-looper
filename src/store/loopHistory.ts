"use client";

import { create } from "zustand";
import { activeLoop, type Track } from "@/lib/types";
import { currentTrack, useCurrentTrack, useLibrary } from "./library";

/**
 * Undo/redo for the A/B bounds of the active loop.
 *
 * History is kept per loop (track id + loop id), so switching track or loop
 * shows that loop's own stack. Every path that moves A or B goes through
 * `library.patchActiveLoop`, so recording happens in a store subscription
 * rather than at each call site.
 */

interface AB {
  a: number;
  b: number;
}

interface Entry {
  past: AB[];
  future: AB[];
}

/** Depth of the per-loop stack, as user-visible steps. */
export const HISTORY_LIMIT = 10;

/** Loops we keep a stack for; older ones are dropped so the map can't grow forever. */
const MAX_TRACKED_LOOPS = 24;

interface LoopHistoryState {
  entries: Record<string, Entry>;
}

const useHistory = create<LoopHistoryState>(() => ({ entries: {} }));

const keyOf = (trackId: string, loopId: string) => `${trackId}:${loopId}`;

function activeKey(): { key: string; track: Track; ab: AB } | null {
  const s = useLibrary.getState();
  const track = currentTrack(s);
  if (!track) return null;
  const l = activeLoop(track);
  return { key: keyOf(track.id, l.id), track, ab: { a: l.a, b: l.b } };
}

function forget(entries: Record<string, Entry>): Record<string, Entry> {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_TRACKED_LOOPS) return entries;
  const trimmed = { ...entries };
  for (const k of keys.slice(0, keys.length - MAX_TRACKED_LOOPS)) delete trimmed[k];
  return trimmed;
}

/** Set while undo/redo writes to the library, so the write isn't recorded. */
let applying = false;

/** Open drag gesture: all its patches collapse into a single history step. */
let gestureOpen = false;
let gestureRecorded = false;

/** Start collapsing loop edits into one undo step (waveform handle drags). */
export function beginLoopGesture(): void {
  gestureOpen = true;
  gestureRecorded = false;
}

export function endLoopGesture(): void {
  gestureOpen = false;
}

function record(key: string, before: AB): void {
  if (gestureOpen && gestureRecorded) return;
  gestureRecorded = true;
  useHistory.setState((s) => {
    const e = s.entries[key] ?? { past: [], future: [] };
    const past = [...e.past, before].slice(-HISTORY_LIMIT);
    return { entries: forget({ ...s.entries, [key]: { past, future: [] } }) };
  });
}

/** Snapshot of what history cares about, as a string so plain equality works. */
function stamp(s: { tracks: Track[]; currentId: string | null }): string {
  const t = currentTrack(s);
  if (!t) return "";
  const l = activeLoop(t);
  return `${t.id}|${l.id}|${l.a}|${l.b}|${t.duration}`;
}

let started = false;

/** Watch the library and push a history step whenever the active loop's A/B move. */
export function startLoopHistory(): void {
  if (started) return;
  started = true;
  useLibrary.subscribe(stamp, (next, prev) => {
    if (applying || !next || !prev) return;
    const [trackId, loopId, a, b, dur] = prev.split("|");
    const [nTrackId, nLoopId, , , nDur] = next.split("|");
    // only a move of the same loop is an edit; track/loop switches are not,
    // and neither is the re-clamp a late real duration triggers
    if (trackId !== nTrackId || loopId !== nLoopId || dur !== nDur) return;
    record(keyOf(trackId, loopId), { a: Number(a), b: Number(b) });
  });
}

function step(dir: "undo" | "redo"): void {
  const c = activeKey();
  if (!c) return;
  const e = useHistory.getState().entries[c.key];
  const from = dir === "undo" ? e?.past : e?.future;
  if (!from?.length) return;
  const target = from[from.length - 1];

  applying = true;
  try {
    useLibrary.getState().patchActiveLoop({ a: target.a, b: target.b });
  } finally {
    applying = false;
  }

  useHistory.setState((s) => {
    const cur = s.entries[c.key] ?? { past: [], future: [] };
    const moved =
      dir === "undo"
        ? { past: cur.past.slice(0, -1), future: [...cur.future, c.ab].slice(-HISTORY_LIMIT) }
        : { future: cur.future.slice(0, -1), past: [...cur.past, c.ab].slice(-HISTORY_LIMIT) };
    return { entries: { ...s.entries, [c.key]: { ...cur, ...moved } } };
  });
}

/** Revert the last A/B change on the active loop. */
export function undoLoopEdit(): void {
  step("undo");
}

/** Re-apply the last undone A/B change on the active loop. */
export function redoLoopEdit(): void {
  step("redo");
}

function useEntry<T>(pick: (e: Entry | undefined) => T): T {
  const track = useCurrentTrack();
  const key = track ? keyOf(track.id, activeLoop(track).id) : "";
  return useHistory((s) => pick(s.entries[key]));
}

export function useCanUndoLoop(): boolean {
  return useEntry((e) => !!e?.past.length);
}

export function useCanRedoLoop(): boolean {
  return useEntry((e) => !!e?.future.length);
}
