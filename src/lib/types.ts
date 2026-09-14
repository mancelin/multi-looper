export type TrackKind = "file" | "youtube";

/**
 * Optional companion content shown above the video/waveform — an image
 * (sheet music, album art) or markdown notes (chords, lyrics, reminders).
 * A track carries at most one; picking a kind replaces whatever was there.
 */
export type ExtraMedia =
  | { type: "image"; src: string }
  | { type: "markdown"; text: string };

export type ExtraMediaType = ExtraMedia["type"];

export interface Loop {
  id: string;
  name: string;
  /** loop start, seconds */
  a: number;
  /** loop end, seconds */
  b: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  hasVideo?: boolean;
  title: string;
  artist: string;
  tags: string[];
  duration: number;
  /** true when `duration` came from a real decode, so the media element must
   *  not overwrite it (MediaRecorder webm under-reports its own length) */
  durationExact?: boolean;
  /** always >= 1 entry, kept sorted by `a` */
  loops: Loop[];
  activeLoopId: string;
  accent: string;
  /** library position, ascending; only meaningful for restoring order after a sync round-trip */
  sortOrder?: number;
  peaks?: number[];
  thumb?: string;
  /** image or markdown notes shown above the video/waveform */
  extraMedia?: ExtraMedia;
  /** playable media URL: object URL for fresh uploads, PocketBase file URL when synced */
  url?: string;
  videoId?: string;
  /** PocketBase record id once synced */
  pbId?: string;
}

export const ACCENTS = {
  youtube: "#fca5a5",
  audioFile: "#93c5fd",
  videoFile: "#c4b5fd",
  default: "#5eead4",
} as const;

/**
 * Tracks stored before extra media existed carry a bare `image` data URL.
 * Rewrites them in place on the way out of localStorage / PocketBase; the
 * legacy field is dropped so it stops round-tripping.
 */
export function migrateExtraMedia(track: Track): Track {
  const legacy = track as Track & { image?: string };
  if (!legacy.extraMedia && legacy.image) {
    legacy.extraMedia = { type: "image", src: legacy.image };
  }
  delete legacy.image;
  return track;
}

export function activeLoop(track: Track): Loop {
  return track.loops.find((l) => l.id === track.activeLoopId) ?? track.loops[0];
}

export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
