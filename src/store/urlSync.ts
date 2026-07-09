"use client";

import { useLibrary, type LibraryState } from "@/store/library";

/** 1-based position of the current track in the library, or null when empty. */
function trackNumber(s: Pick<LibraryState, "tracks" | "currentId">): number | null {
  if (!s.tracks.length) return null;
  const i = s.tracks.findIndex((t) => t.id === s.currentId);
  return (i === -1 ? 0 : i) + 1;
}

/**
 * Select the track named by the current URL (`/3` → third track).
 * Any other non-root path falls back to the first track; `startUrlSync()`
 * rewrites the URL to the actual selection right after.
 */
export function applyTrackFromUrl(): void {
  const path = window.location.pathname;
  if (path === "/") return; // keep the restored selection
  const { tracks, selectTrack } = useLibrary.getState();
  if (!tracks.length) return;
  const m = /^\/(\d+)\/?$/.exec(path);
  const n = m ? Number(m[1]) : NaN;
  selectTrack(tracks[n >= 1 && n <= tracks.length ? n - 1 : 0].id);
}

/** Mirror the current track's library position into the URL (`/1`, `/2`, … or `/`). */
export function startUrlSync(): void {
  const write = (n: number | null) => {
    const path = n === null ? "/" : `/${n}`;
    if (window.location.pathname !== path) window.history.replaceState(null, "", path);
  };
  write(trackNumber(useLibrary.getState()));
  useLibrary.subscribe((s) => trackNumber(s), write);
}
