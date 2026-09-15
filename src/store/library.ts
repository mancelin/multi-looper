"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { clampSegments } from "@/lib/extraMedia";
import { activeLoop, uid, type Loop, type Track } from "@/lib/types";

export interface LibraryState {
  tracks: Track[];
  currentId: string | null;
  search: string;

  setSearch: (q: string) => void;
  setLibrary: (tracks: Track[], currentId?: string | null) => void;
  addTracks: (tracks: Track[], select?: boolean) => void;
  removeTrack: (id: string) => void;
  selectTrack: (id: string) => void;
  patchTrack: (id: string, fields: Partial<Track>) => void;
  reorderTracks: (dragId: string, targetId: string, after: boolean) => void;
  patchDuration: (id: string, duration: number) => void;

  selectLoop: (loopId: string) => void;
  addLoopAt: (time: number) => void;
  removeLoop: (loopId: string) => void;
  renameLoop: (loopId: string, name: string) => void;
  patchActiveLoop: (fields: Partial<Pick<Loop, "a" | "b">>) => void;

  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
}

const sortLoops = (loops: Loop[]) => [...loops].sort((a, b) => a.a - b.a);

function mapCurrent(tracks: Track[], currentId: string | null, fn: (t: Track) => Track) {
  return tracks.map((t) => (t.id === currentId ? fn(t) : t));
}

export const useLibrary = create<LibraryState>()(
  subscribeWithSelector((set) => ({
    tracks: [],
    currentId: null,
    search: "",

    setSearch: (q) => set({ search: q }),

    setLibrary: (tracks, currentId) =>
      set({ tracks, currentId: currentId !== undefined ? currentId : (tracks[0]?.id ?? null) }),

    addTracks: (newTracks, select = true) =>
      set((s) => {
        // new tracks go on top and must stay there after a sync round-trip
        const top = Math.min(0, ...s.tracks.map((t) => t.sortOrder ?? 0));
        const added = newTracks.map((t, i) => ({
          ...t,
          sortOrder: top - (newTracks.length - i),
        }));
        return {
          tracks: [...added, ...s.tracks],
          currentId: select && added.length ? added[0].id : s.currentId,
        };
      }),

    removeTrack: (id) =>
      set((s) => {
        const list = s.tracks.filter((t) => t.id !== id);
        const currentId = id === s.currentId ? (list[0]?.id ?? null) : s.currentId;
        return { tracks: list, currentId };
      }),

    selectTrack: (id) => set({ currentId: id }),

    patchTrack: (id, fields) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...fields } : t)) })),

    /** Move `dragId` before (or after) `targetId`; renumbers `sortOrder` so the order survives sync. */
    reorderTracks: (dragId, targetId, after) =>
      set((s) => {
        if (dragId === targetId) return {};
        const from = s.tracks.findIndex((t) => t.id === dragId);
        if (from < 0) return {};
        const list = [...s.tracks];
        const [moved] = list.splice(from, 1);
        const to = list.findIndex((t) => t.id === targetId);
        if (to < 0) return {};
        list.splice(after ? to + 1 : to, 0, moved);
        return { tracks: list.map((t, i) => (t.sortOrder === i ? t : { ...t, sortOrder: i })) };
      }),

    patchDuration: (id, d) =>
      set((s) => ({
        tracks: s.tracks.map((t) => {
          if (t.id !== id) return t;
          const loops = t.loops.map((l) => {
            // A loop spanning the old (possibly placeholder) duration stays full-track.
            const wasFull = l.b >= t.duration - 0.05;
            const a = Math.min(l.a, Math.max(0, d - 0.1));
            const b = wasFull ? d : Math.max(a + 0.05, Math.min(l.b, d));
            return { ...l, a, b };
          });
          return {
            ...t,
            duration: d,
            durationExact: true,
            loops,
            extraMedia: clampSegments(t.extraMedia, d),
          };
        }),
      })),

    selectLoop: (loopId) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => ({ ...t, activeLoopId: loopId })),
      })),

    addLoopAt: (time) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => {
          const a = Math.max(0, Math.min(time, t.duration - 0.2));
          const b = Math.min(t.duration, a + Math.max(2, Math.min(8, t.duration * 0.12)));
          const loop: Loop = { id: uid("l"), name: `Loop ${t.loops.length + 1}`, a, b };
          return { ...t, loops: sortLoops([...t.loops, loop]), activeLoopId: loop.id };
        }),
      })),

    removeLoop: (loopId) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => {
          if (t.loops.length <= 1) return t; // never remove the last loop
          const loops = t.loops.filter((l) => l.id !== loopId);
          const activeLoopId = t.activeLoopId === loopId ? loops[0].id : t.activeLoopId;
          return { ...t, loops, activeLoopId };
        }),
      })),

    renameLoop: (loopId, name) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => ({
          ...t,
          loops: t.loops.map((l) => (l.id === loopId ? { ...l, name } : l)),
        })),
      })),

    patchActiveLoop: (fields) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => ({
          ...t,
          loops: sortLoops(
            t.loops.map((l) => (l.id === t.activeLoopId ? { ...l, ...fields } : l)),
          ),
        })),
      })),

    addTag: (tag) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => {
          const v = tag.trim().replace(/,/g, "");
          if (!v || t.tags.some((x) => x.toLowerCase() === v.toLowerCase())) return t;
          return { ...t, tags: [...t.tags, v] };
        }),
      })),

    removeTag: (tag) =>
      set((s) => ({
        tracks: mapCurrent(s.tracks, s.currentId, (t) => ({
          ...t,
          tags: t.tags.filter((x) => x !== tag),
        })),
      })),
  })),
);

export function currentTrack(s: Pick<LibraryState, "tracks" | "currentId">): Track | undefined {
  return s.tracks.find((t) => t.id === s.currentId) ?? s.tracks[0];
}

export function useCurrentTrack(): Track | undefined {
  return useLibrary((s) => s.tracks.find((t) => t.id === s.currentId) ?? s.tracks[0]);
}

export function useActiveLoop(): Loop | undefined {
  const track = useCurrentTrack();
  return track ? activeLoop(track) : undefined;
}
