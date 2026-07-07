"use client";

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
    },
  );
}
