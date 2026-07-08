"use client";

import { registerFile } from "@/lib/fileRegistry";
import { getMedia, pruneMedia } from "@/lib/mediaStore";
import type { Track } from "@/lib/types";
import { useLibrary } from "./library";
import { useUi } from "./ui";

const KEY = "multilooper_guest_lib";

interface GuestLib {
  tracks: Track[];
  currentId: string | null;
}

/** Strip runtime-only fields (object URLs, PB ids) before serializing. */
function serializable(tracks: Track[]): Track[] {
  return tracks.map((t) => {
    const copy: Track = { ...t };
    delete copy.url;
    delete copy.pbId;
    return copy;
  });
}

export function loadGuestLibrary(): GuestLib | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestLib;
    if (!Array.isArray(parsed.tracks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuestLibrary(tracks: Track[], currentId: string | null): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tracks: serializable(tracks), currentId }));
  } catch {
    // storage full / unavailable — guest persistence is best-effort
  }
}

/**
 * Re-attach IndexedDB media blobs to file tracks after a reload: registers
 * the File and sets a fresh object URL on the track (in place, so call it
 * before handing the tracks to the store).
 */
export async function restoreFileMedia(tracks: Track[]): Promise<void> {
  await Promise.all(
    tracks.map(async (t) => {
      if (t.kind !== "file" || t.url) return;
      const file = await getMedia(t.id);
      if (!file) return; // pre-IndexedDB track — still needs re-upload
      registerFile(t.id, file);
      t.url = URL.createObjectURL(file);
    }),
  );
}

let started = false;

/** Mirror the library to localStorage while signed out. */
export function startGuestPersistence(): void {
  if (started) return;
  started = true;
  useLibrary.subscribe(
    (s) => ({ tracks: s.tracks, currentId: s.currentId }),
    ({ tracks, currentId }) => {
      if (useUi.getState().account) return;
      saveGuestLibrary(tracks, currentId);
      void pruneMedia(new Set(tracks.map((t) => t.id)));
    },
  );
}
