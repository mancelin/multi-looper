"use client";

import { registerFile } from "@/lib/fileRegistry";
import { putMedia } from "@/lib/mediaStore";
import { decodePeaks } from "@/lib/peaks";
import { player } from "@/lib/player/controller";
import {
  extractTidalTrackId,
  fetchTidalMeta,
  syntheticTidalPeaks,
  TIDAL_PLACEHOLDER_TITLE,
} from "@/lib/tidal";
import { ACCENTS, uid, type Track } from "@/lib/types";
import { extractVideoId, syntheticYtPeaks, thumbUrl, YT_PLACEHOLDER_TITLE } from "@/lib/youtube";
import { useLibrary } from "./library";

/** Returns false when the input doesn't contain a YouTube video id. */
export function addYoutubeUrl(input: string): boolean {
  const videoId = extractVideoId(input);
  if (!videoId) return false;
  const loopId = uid("l");
  const track: Track = {
    id: uid("y"),
    kind: "youtube",
    videoId,
    title: YT_PLACEHOLDER_TITLE, // replaced with the video title once the player reports it
    artist: "youtube.com",
    tags: ["youtube"],
    duration: 210, // placeholder; patched from the IFrame player once ready
    loops: [{ id: loopId, name: "Loop 1", a: 0, b: 210 }],
    activeLoopId: loopId,
    accent: ACCENTS.youtube,
    thumb: thumbUrl(videoId),
    peaks: syntheticYtPeaks(videoId),
  };
  player.pause();
  useLibrary.getState().addTracks([track]);
  return true;
}

/** Returns false when the input doesn't contain a TIDAL track link. */
export function addTidalUrl(input: string): boolean {
  const tidalId = extractTidalTrackId(input);
  if (!tidalId) return false;
  const loopId = uid("l");
  const track: Track = {
    id: uid("t"),
    kind: "tidal",
    tidalId,
    title: TIDAL_PLACEHOLDER_TITLE, // replaced once the open API / player reports metadata
    artist: "tidal.com",
    tags: ["tidal"],
    duration: 210, // placeholder; patched from metadata or the SDK player
    loops: [{ id: loopId, name: "Loop 1", a: 0, b: 210 }],
    activeLoopId: loopId,
    accent: ACCENTS.tidal,
    peaks: syntheticTidalPeaks(tidalId),
  };
  player.pause();
  useLibrary.getState().addTracks([track]);
  // best-effort metadata (needs a connected TIDAL account); placeholder stays otherwise
  void fetchTidalMeta(tidalId).then((meta) => {
    if (!meta) return;
    const lib = useLibrary.getState();
    const cur = lib.tracks.find((t) => t.id === track.id);
    if (!cur) return; // removed meanwhile
    lib.patchTrack(track.id, {
      ...(meta.title && cur.title === TIDAL_PLACEHOLDER_TITLE ? { title: meta.title } : {}),
      ...(meta.artist ? { artist: meta.artist } : {}),
      ...(meta.cover ? { thumb: meta.cover } : {}),
    });
    if (meta.duration) lib.patchDuration(track.id, meta.duration);
  });
  return true;
}

export async function addFiles(files: File[]): Promise<void> {
  if (!files.length) return;
  const tracks: Track[] = [];
  for (const f of files) {
    const id = uid("f");
    const url = URL.createObjectURL(f);
    const isVideo = (f.type || "").startsWith("video/");
    const { peaks, duration } = await decodePeaks(f);
    const dur = duration || 120; // 0 = decode failed; patched on loadedmetadata
    const loopId = uid("l");
    const track: Track = {
      id,
      kind: "file",
      hasVideo: isVideo,
      title: f.name.replace(/\.[^.]+$/, ""),
      artist: isVideo ? "Local video" : "Local file",
      tags: [(f.name.split(".").pop() || "audio").toUpperCase()],
      duration: dur,
      loops: [{ id: loopId, name: "Loop 1", a: 0, b: dur }],
      activeLoopId: loopId,
      accent: isVideo ? ACCENTS.videoFile : ACCENTS.audioFile,
      peaks,
      url,
    };
    registerFile(id, f);
    void putMedia(id, f); // survive reload (guest mode restores from IndexedDB)
    tracks.push(track);
  }
  player.pause();
  useLibrary.getState().addTracks(tracks);
}
