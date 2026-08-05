"use client";

import { player } from "@/lib/player/controller";
import { activeLoop } from "@/lib/types";
import { currentTrack, useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

/** Shared clamped loop-edit operations (UI buttons + keyboard shortcuts). */

/** Smallest allowed A→B distance. */
export const MIN_GAP = 0.05;

function ctx() {
  const s = useLibrary.getState();
  const track = currentTrack(s);
  if (!track) return null;
  return { s, track, loop: activeLoop(track) };
}

/** A can only land left of B (min gap): past it the edit is refused, not clamped. */
export function canSetLoopA(v: number): boolean {
  const c = ctx();
  return !!c && v <= c.loop.b - MIN_GAP;
}

/** Mirror of {@link canSetLoopA} for the loop end. */
export function canSetLoopB(v: number): boolean {
  const c = ctx();
  return !!c && v >= c.loop.a + MIN_GAP;
}

export function setLoopA(v: number): void {
  const c = ctx();
  if (!c || v > c.loop.b - MIN_GAP) return;
  c.s.patchActiveLoop({ a: Math.max(0, v) });
}

export function setLoopB(v: number): void {
  const c = ctx();
  if (!c || v < c.loop.a + MIN_GAP) return;
  c.s.patchActiveLoop({ b: Math.min(v, c.track.duration) });
  // committing a loop end means the user wants looping on
  useUi.setState({ loopEnabled: true });
}

export function nudgeA(delta: number): void {
  const c = ctx();
  if (!c) return;
  // fine trim still clamps at the min gap rather than refusing the step
  setLoopA(Math.min(c.loop.a + delta, c.loop.b - MIN_GAP));
}

export function nudgeB(delta: number): void {
  const c = ctx();
  if (!c) return;
  setLoopB(Math.max(c.loop.b + delta, c.loop.a + MIN_GAP));
}

export function addLoopAtPlayhead(): void {
  const c = ctx();
  if (!c) return;
  c.s.addLoopAt(player.getT());
  const after = ctx();
  if (after) player.setT(after.loop.a);
}

export function selectLoopAndSeek(loopId: string): void {
  const c = ctx();
  if (!c) return;
  c.s.selectLoop(loopId);
  const l = c.track.loops.find((x) => x.id === loopId);
  if (l) player.setT(l.a);
}

export function cycleLoop(dir: 1 | -1): void {
  const c = ctx();
  if (!c || c.track.loops.length < 2) return;
  const i = c.track.loops.findIndex((l) => l.id === c.track.activeLoopId);
  const next = c.track.loops[(i + dir + c.track.loops.length) % c.track.loops.length];
  selectLoopAndSeek(next.id);
}
