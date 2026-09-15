export type TrackKind = "file" | "youtube";

/**
 * Companion content shown above the video/waveform — an image (sheet music,
 * album art) or markdown notes (chords, lyrics, reminders). One segment
 * carries at most one; picking a kind replaces whatever was there.
 */
export type ExtraMedia =
  | { type: "image"; src: string }
  | { type: "markdown"; text: string };

export type ExtraMediaType = ExtraMedia["type"];

/**
 * One stretch of the track with its own extra media. Segments PARTITION the
 * track: sorted by `start`, gapless, the first starting at 0 and the last
 * ending at `duration`, so exactly one is showing at any moment. A segment
 * with no `media` yet is a real segment that asks for its content.
 */
export interface ExtraMediaSegment {
  id: string;
  /** seconds, inclusive */
  start: number;
  /** seconds, exclusive (except on the last segment) */
  end: number;
  media?: ExtraMedia;
}

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
  /** timed extra-media segments partitioning the track; absent when it has none */
  extraMedia?: ExtraMediaSegment[];
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
 * Two older shapes reach us from localStorage / PocketBase: a bare `image`
 * data URL (before extra media existed) and a single untimed `extraMedia`
 * object (before segments). Both become one segment spanning the whole
 * track. Rewritten in place, and the legacy field dropped so it stops
 * round-tripping.
 */
export function migrateExtraMedia(track: Track): Track {
  const legacy = track as Track & { image?: string; extraMedia?: unknown };
  if (!Array.isArray(legacy.extraMedia)) {
    const untimed = legacy.extraMedia as ExtraMedia | null | undefined;
    const media: ExtraMedia | undefined =
      untimed && typeof untimed === "object" && "type" in untimed
        ? untimed
        : legacy.image
          ? { type: "image", src: legacy.image }
          : undefined;
    legacy.extraMedia = media
      ? [{ id: uid("em"), start: 0, end: track.duration, media }]
      : undefined;
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
