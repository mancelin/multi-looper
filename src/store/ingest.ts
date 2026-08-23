"use client";

import { registerFile } from "@/lib/fileRegistry";
import { putMedia } from "@/lib/mediaStore";
import { decodePeaks } from "@/lib/peaks";
import { player } from "@/lib/player/controller";
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

/**
 * Adds a microphone take as a local file track and selects it.
 * The record modal already decoded the blob, so peaks/duration come in ready
 * rather than being decoded a second time here.
 */
export function addRecording(
  file: File,
  title: string,
  peaks: number[],
  duration: number,
): void {
  const id = uid("r");
  const url = URL.createObjectURL(file);
  const loopId = uid("l");
  const track: Track = {
    id,
    kind: "file",
    title: title.trim() || "Recording",
    artist: "Recording",
    tags: ["REC"],
    duration,
    loops: [{ id: loopId, name: "Loop 1", a: 0, b: duration }],
    activeLoopId: loopId,
    accent: ACCENTS.recording,
    peaks,
    url,
  };
  registerFile(id, file);
  void putMedia(id, file); // survive reload (guest mode restores from IndexedDB)
  player.pause();
  useLibrary.getState().addTracks([track]);
}
