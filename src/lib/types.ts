export type TrackKind = "file" | "youtube";

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
  /** always >= 1 entry, kept sorted by `a` */
  loops: Loop[];
  activeLoopId: string;
  accent: string;
  /** library position, ascending; only meaningful for restoring order after a sync round-trip */
  sortOrder?: number;
  peaks?: number[];
  thumb?: string;
  /** cover image as a data URL (downscaled), shown above the waveform for file tracks */
  image?: string;
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
  recording: "#fdba74",
  default: "#5eead4",
} as const;

export function activeLoop(track: Track): Loop {
  return track.loops.find((l) => l.id === track.activeLoopId) ?? track.loops[0];
}

export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
