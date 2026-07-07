"use client";

import { player } from "@/lib/player/controller";
import { activeLoop } from "@/lib/types";
import { currentTrack, useLibrary } from "@/store/library";

/** Shared clamped loop-edit operations (UI buttons + keyboard shortcuts). */

function ctx() {
  const s = useLibrary.getState();
  const track = currentTrack(s);
  if (!track) return null;
  return { s, track, loop: activeLoop(track) };
}

export function setLoopA(v: number): void {
  const c = ctx();
  if (!c) return;
  c.s.patchActiveLoop({ a: Math.max(0, Math.min(v, c.loop.b - 0.05)) });
}

export function setLoopB(v: number): void {
  const c = ctx();
  if (!c) return;
  c.s.patchActiveLoop({ b: Math.max(c.loop.a + 0.05, Math.min(v, c.track.duration)) });
}

export function nudgeA(delta: number): void {
  const c = ctx();
  if (!c) return;
  setLoopA(c.loop.a + delta);
}

export function nudgeB(delta: number): void {
  const c = ctx();
  if (!c) return;
  setLoopB(c.loop.b + delta);
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
