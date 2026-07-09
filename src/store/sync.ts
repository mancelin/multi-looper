"use client";

import { ClientResponseError, type RecordModel } from "pocketbase";
import { clearFiles, getFile, releaseFile } from "@/lib/fileRegistry";
import { clearImageHeights } from "@/lib/imageSize";
import { clearAllMedia } from "@/lib/mediaStore";
import { pb } from "@/lib/pb";
import { player } from "@/lib/player/controller";
import type { Track } from "@/lib/types";
import { clearGuestLibrary } from "./guestPersist";
import { useLibrary } from "./library";
import { useUi } from "./ui";

const COLLECTION = "tracks";

// ---------- record mapping ----------

function recordToTrack(r: RecordModel): Track {
  const media = r.media as string | undefined;
  return {
    id: r.id,
    pbId: r.id,
    kind: r.kind as Track["kind"],
    hasVideo: !!r.hasVideo,
    title: (r.title as string) || "Untitled",
    artist: (r.artist as string) || "",
    tags: (r.tags as string[]) ?? [],
    duration: (r.duration as number) || 1,
    loops: (r.loops as Track["loops"]) ?? [],
    activeLoopId: (r.activeLoopId as string) || "",
    accent: (r.accent as string) || "#5eead4",
    peaks: (r.peaks as number[]) ?? undefined,
    thumb: (r.thumb as string) || undefined,
    image: (r.image as string) || undefined,
    videoId: (r.videoId as string) || undefined,
    url: media ? pb.files.getURL(r, media) : undefined,
  };
}

function trackPayload(t: Track): Record<string, unknown> {
  return {
    user: pb.authStore.record?.id,
    kind: t.kind,
    hasVideo: !!t.hasVideo,
    title: t.title,
    artist: t.artist,
    tags: t.tags,
    duration: t.duration,
    loops: t.loops,
    activeLoopId: t.activeLoopId,
    accent: t.accent,
    peaks: t.peaks ?? [],
    thumb: t.thumb ?? "",
    image: t.image ?? "",
    videoId: t.videoId ?? "",
  };
}

/** Comparable fingerprint — runtime-only fields excluded. */
function fingerprint(t: Track): string {
  const copy: Partial<Track> = { ...t };
  delete copy.url;
  delete copy.pbId;
  delete copy.id;
  return JSON.stringify(copy);
}

// ---------- debounced sync queue ----------

const synced = new Map<string, string>(); // local track id -> fingerprint
const pbIds = new Map<string, string>(); // local track id -> PB record id
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let subscribed = false;

function scheduleFlush(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 800);
}

async function flush(): Promise<void> {
  if (flushing) {
    scheduleFlush();
    return;
  }
  if (!useUi.getState().account || !pb.authStore.isValid) return;
  flushing = true;
  useUi.getState().setSyncBusy(true);
  try {
    const tracks = useLibrary.getState().tracks;
    const liveIds = new Set(tracks.map((t) => t.id));

    for (const [localId, recId] of [...pbIds]) {
      if (liveIds.has(localId)) continue;
      try {
        await pb.collection(COLLECTION).delete(recId);
      } catch (e) {
        if (!(e instanceof ClientResponseError && e.status === 404)) throw e;
      }
      pbIds.delete(localId);
      synced.delete(localId);
    }

    for (const t of tracks) {
      const fp = fingerprint(t);
      if (synced.get(t.id) === fp) continue;
      const recId = pbIds.get(t.id) ?? t.pbId;
      if (recId) {
        await pb.collection(COLLECTION).update(recId, trackPayload(t));
      } else {
        const payload = trackPayload(t);
        const file = t.kind === "file" ? getFile(t.id) : undefined;
        let rec: RecordModel;
        if (file) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(payload)) {
            fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
          }
          fd.append("media", file);
          rec = await pb.collection(COLLECTION).create(fd);
          releaseFile(t.id);
        } else {
          rec = await pb.collection(COLLECTION).create(payload);
        }
        pbIds.set(t.id, rec.id);
        useLibrary.getState().patchTrack(t.id, { pbId: rec.id });
      }
      synced.set(t.id, fp);
    }
  } catch (e) {
    console.error("[sync] flush failed", e);
  } finally {
    flushing = false;
    useUi.getState().setSyncBusy(false);
  }
}

export function startSync(): void {
  if (subscribed) return;
  subscribed = true;
  useLibrary.subscribe(
    (s) => s.tracks,
    () => {
      if (useUi.getState().account) scheduleFlush();
    },
  );
}

function seedSyncState(tracks: Track[]): void {
  synced.clear();
  pbIds.clear();
  for (const t of tracks) {
    if (t.pbId) {
      pbIds.set(t.id, t.pbId);
      synced.set(t.id, fingerprint(t));
    }
  }
}

// ---------- auth flows ----------

let pendingGuest: Track[] | null = null;
let pendingSaved: Track[] | null = null;

async function fetchAccountTracks(): Promise<Track[]> {
  const records = await pb.collection(COLLECTION).getFullList({ sort: "-created" });
  return records.map(recordToTrack);
}

function applyLibrary(tracks: Track[]): void {
  player.pause();
  seedSyncState(tracks);
  useLibrary.getState().setLibrary(tracks);
}

async function handleAuthed(): Promise<void> {
  const record = pb.authStore.record;
  if (!record) return;
  const ui = useUi.getState();
  ui.setAccount({ id: record.id, email: record.email as string });
  const saved = await fetchAccountTracks();
  const guest = useLibrary.getState().tracks;
  if (guest.length > 0) {
    pendingGuest = guest;
    pendingSaved = saved;
    ui.setImport(true, guest.length);
  } else {
    applyLibrary(saved);
  }
  startSync();
}

function authErrorMessage(e: unknown, mode: "signup" | "signin"): string {
  if (e instanceof ClientResponseError) {
    const data = e.response?.data as Record<string, { message?: string }> | undefined;
    const field = data && Object.values(data)[0]?.message;
    if (field) return field;
    if (e.status === 400) {
      return mode === "signin"
        ? "Invalid email or password."
        : "Could not create the account. Is the email already registered?";
    }
    if (e.status === 0) return "Cannot reach the sync server.";
  }
  return "Something went wrong. Please try again.";
}

export async function submitAuth(email: string, password: string): Promise<void> {
  const ui = useUi.getState();
  email = email.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    ui.setAuthError("Enter a valid email address.");
    return;
  }
  if (password.length < 8) {
    ui.setAuthError("Password must be at least 8 characters.");
    return;
  }
  ui.setAuthError("");
  ui.setAuthBusy(true);
  try {
    if (ui.authMode === "signup") {
      await pb.collection("users").create({ email, password, passwordConfirm: password });
    }
    await pb.collection("users").authWithPassword(email, password);
    useUi.getState().closeAuth();
    useUi.getState().setAccountMenuOpen(false);
    await handleAuthed();
  } catch (e) {
    ui.setAuthError(authErrorMessage(e, ui.authMode));
  } finally {
    useUi.getState().setAuthBusy(false);
  }
}

export function importGuestLibrary(): void {
  const guest = pendingGuest ?? [];
  const saved = pendingSaved ?? [];
  pendingGuest = pendingSaved = null;
  const guestIds = new Set(guest.map((t) => t.id));
  const merged = [...guest, ...saved.filter((t) => !guestIds.has(t.id))];
  useUi.getState().setImport(false);
  applyLibrary(merged);
  scheduleFlush(); // guest tracks lack pbId -> created (with media upload) on flush
}

export function skipImport(): void {
  const saved = pendingSaved ?? [];
  pendingGuest = pendingSaved = null;
  useUi.getState().setImport(false);
  applyLibrary(saved);
}

/** Sign out and wipe all local data — the app restarts as new. */
export async function signOut(): Promise<void> {
  if (timer) clearTimeout(timer);
  await flush().catch(() => {});
  pb.authStore.clear();
  useUi.getState().setAccount(null);
  useUi.getState().setAccountMenuOpen(false);
  synced.clear();
  pbIds.clear();
  player.pause();
  useLibrary.getState().setLibrary([], null);
  clearFiles();
  clearGuestLibrary();
  clearImageHeights();
  await clearAllMedia();
}

/** Restore a persisted PocketBase session on app boot. */
export async function bootAuth(): Promise<boolean> {
  if (!pb.authStore.isValid || !pb.authStore.record) return false;
  try {
    await pb.collection("users").authRefresh();
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 401) {
      pb.authStore.clear();
      return false;
    }
    // server unreachable — keep the cached session and try to work offline
  }
  const record = pb.authStore.record;
  useUi.getState().setAccount({ id: record.id, email: record.email as string });
  try {
    const saved = await fetchAccountTracks();
    applyLibrary(saved);
  } catch {
    // offline: leave whatever is local
  }
  startSync();
  return true;
}
