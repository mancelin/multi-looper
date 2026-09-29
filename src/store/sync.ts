"use client";

import { ClientResponseError, type RecordModel } from "pocketbase";
import { clearFiles, getFile, releaseFile } from "@/lib/fileRegistry";
import { clearExtraMediaHeights } from "@/lib/extraMediaSize";
import { clearAllMedia } from "@/lib/mediaStore";
import { pb } from "@/lib/pb";
import { player } from "@/lib/player/controller";
import { migrateExtraMedia, type Track } from "@/lib/types";
import { clearGuestLibrary } from "./guestPersist";
import { useLibrary } from "./library";
import { useUi } from "./ui";

const COLLECTION = "tracks";

// server quota rejection (pb_hooks/quota.pb.js) - matched by message prefix
const QUOTA_PREFIX = "Storage limit reached";

function isQuotaError(e: unknown): e is ClientResponseError {
  return (
    e instanceof ClientResponseError &&
    e.status === 400 &&
    typeof e.response?.message === "string" &&
    (e.response.message as string).startsWith(QUOTA_PREFIX)
  );
}

// ---------- record mapping ----------

function recordToTrack(r: RecordModel): Track {
  const media = r.media as string | undefined;
  return migrateExtraMedia({
    id: r.id,
    pbId: r.id,
    kind: r.kind as Track["kind"],
    hasVideo: !!r.hasVideo,
    title: (r.title as string) || "Untitled",
    artist: (r.artist as string) || "",
    tags: (r.tags as string[]) ?? [],
    duration: (r.duration as number) || 1,
    durationExact: !!r.durationExact,
    loops: (r.loops as Track["loops"]) ?? [],
    activeLoopId: (r.activeLoopId as string) || "",
    accent: (r.accent as string) || "#5eead4",
    sortOrder: (r.sortOrder as number) || 0,
    peaks: (r.peaks as number[]) ?? undefined,
    thumb: (r.thumb as string) || undefined,
    // an older record can hold a single untimed object here instead of the
    // segment array; migrateExtraMedia below settles both shapes
    extraMedia: (r.extraMedia as Track["extraMedia"]) || undefined,
    // legacy field, folded into extraMedia by migrateExtraMedia
    image: (r.image as string) || undefined,
    videoId: (r.videoId as string) || undefined,
    url: media ? pb.files.getURL(r, media) : undefined,
  } as Track);
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
    durationExact: !!t.durationExact,
    loops: t.loops,
    activeLoopId: t.activeLoopId,
    accent: t.accent,
    sortOrder: t.sortOrder ?? 0,
    peaks: t.peaks ?? [],
    thumb: t.thumb ?? "",
    extraMedia: t.extraMedia ?? null,
    // cleared on the first write back: superseded by extraMedia
    image: "",
    videoId: t.videoId ?? "",
  };
}

/** Comparable fingerprint - runtime-only fields excluded. */
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
const quotaBlocked = new Set<string>(); // local ids refused by the server quota; retried after deletes
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

    let freedSpace = false;
    for (const [localId, recId] of [...pbIds]) {
      if (liveIds.has(localId)) continue;
      try {
        await pb.collection(COLLECTION).delete(recId);
      } catch (e) {
        if (!(e instanceof ClientResponseError && e.status === 404)) throw e;
      }
      pbIds.delete(localId);
      synced.delete(localId);
      freedSpace = true;
    }
    if (freedSpace) quotaBlocked.clear(); // deletions free quota, retry refused uploads

    for (const t of tracks) {
      const fp = fingerprint(t);
      if (synced.get(t.id) === fp) continue;
      const recId = pbIds.get(t.id) ?? t.pbId;
      if (recId) {
        await pb.collection(COLLECTION).update(recId, trackPayload(t));
      } else {
        if (quotaBlocked.has(t.id)) continue; // stays local until quota frees up
        const payload = trackPayload(t);
        const file = t.kind === "file" ? getFile(t.id) : undefined;
        let rec: RecordModel;
        try {
          if (file) {
            const fd = new FormData();
            for (const [k, v] of Object.entries(payload)) {
              fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
            }
            fd.append("media", file);
            rec = await pb.collection(COLLECTION).create(fd);
          } else {
            rec = await pb.collection(COLLECTION).create(payload);
          }
        } catch (e) {
          if (isQuotaError(e)) {
            quotaBlocked.add(t.id);
            useUi.getState().pushToast(`"${t.title}" was not synced: ${e.response.message}`);
            continue;
          }
          throw e;
        }
        if (file) releaseFile(t.id);
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

/**
 * Refresh the account's media storage usage (bytes) from the server - the
 * server-owned mediaSize field is the source of truth across devices.
 */
export async function refreshStorageUsed(): Promise<void> {
  const account = useUi.getState().account;
  if (!account || !pb.authStore.isValid) return;
  try {
    // premium can be toggled from the PB dashboard at any time - re-read it
    const auth = await pb.collection("users").authRefresh();
    const premium = !!auth.record.premium;
    if (premium !== account.premium) {
      useUi.getState().setAccount({ ...account, premium });
      if (premium) {
        quotaBlocked.clear(); // bigger quota, retry refused uploads
        scheduleFlush();
      }
    }
    const records = await pb.collection(COLLECTION).getFullList({ fields: "mediaSize" });
    const used = records.reduce((sum, r) => sum + ((r.mediaSize as number) || 0), 0);
    useUi.getState().setStorageUsed(used);
  } catch {
    // offline - keep whatever value we last showed
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
  quotaBlocked.clear();
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
  // sortOrder is the user's drag order (newest tracks get negative values so
  // they stay on top); -created only breaks ties between never-reordered records
  const records = await pb.collection(COLLECTION).getFullList({ sort: "sortOrder,-created" });
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
  ui.setAccount({ id: record.id, email: record.email as string, premium: !!record.premium });
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

// server account cap (pb_hooks/signup_cap.pb.js) - matched by message prefix
const SIGNUP_CLOSED_PREFIX = "Sign-ups are closed";
const SIGNUP_CLOSED_MESSAGE =
  "Sign-ups are closed for now. Guest mode still works: your library stays on this device.";

function isSignupClosed(e: unknown): boolean {
  return (
    e instanceof ClientResponseError &&
    typeof e.response?.message === "string" &&
    (e.response.message as string).startsWith(SIGNUP_CLOSED_PREFIX)
  );
}

function authErrorMessage(e: unknown, mode: "signup" | "signin"): string {
  if (isSignupClosed(e)) return SIGNUP_CLOSED_MESSAGE;
  if (e instanceof ClientResponseError) {
    const data = e.response?.data as Record<string, { message?: string }> | undefined;
    const field = data && Object.values(data)[0]?.message;
    if (field) return field;
    if (e.status === 400) {
      return mode === "signin"
        ? "Invalid email or password."
        : "Could not create the account. Is the email already registered?";
    }
    // authRule "verified = true" fails -> 403
    if (e.status === 403) return "Please verify your email before signing in.";
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
      // fire-and-forget: PB queues the email and always answers 204
      void pb.collection("users").requestVerification(email).catch(() => {});
      // authRule ("verified = true") rejects sign-in until the email is confirmed
      useUi.getState().closeAuth();
      useUi.getState().pushToast(`Verification email sent to ${email}. Verify, then sign in.`);
      return;
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

/**
 * Consume a `?verify=<token>` link at boot. The PB verification email points
 * here instead of PB's own confirm page (users collection → Verification
 * template, link set to `<app url>/?verify={TOKEN}`) so the flow ends in
 * the app: confirm the token, then open sign-in. The token is stripped from
 * the URL either way so reloads don't re-submit it.
 */
export async function consumeVerificationLink(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("verify");
  if (!token) return;
  params.delete("verify");
  const query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  try {
    await pb.collection("users").confirmVerification(token);
    useUi.getState().openAuth("signin");
    useUi.getState().pushToast("Email verified. Sign in to continue.");
  } catch {
    useUi.getState().pushToast("Verification link is invalid or expired.");
  }
}

export async function signInWithGoogle(): Promise<void> {
  const ui = useUi.getState();
  ui.setAuthError("");
  ui.setAuthBusy(true);
  try {
    await pb.collection("users").authWithOAuth2({ provider: "google" });
    useUi.getState().closeAuth();
    useUi.getState().setAccountMenuOpen(false);
    await handleAuthed();
  } catch (e) {
    if (isSignupClosed(e)) {
      ui.setAuthError(SIGNUP_CLOSED_MESSAGE);
    } else if (e instanceof ClientResponseError && e.status === 0) {
      ui.setAuthError("Cannot reach the sync server.");
    } else {
      ui.setAuthError("Google sign-in was cancelled or failed.");
    }
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

/** Wipe every locally held copy of the library (store, files, caches). */
async function wipeLocalData(): Promise<void> {
  synced.clear();
  pbIds.clear();
  quotaBlocked.clear();
  player.pause();
  useLibrary.getState().setLibrary([], null);
  clearFiles();
  clearGuestLibrary();
  clearExtraMediaHeights();
  await clearAllMedia();
}

/** Sign out and wipe all local data - the app restarts as new. */
export async function signOut(): Promise<void> {
  if (timer) clearTimeout(timer);
  await flush().catch(() => {});
  pb.authStore.clear();
  useUi.getState().setAccount(null);
  useUi.getState().setAccountMenuOpen(false);
  await wipeLocalData();
}

/**
 * Change the signed-in user's password. PocketBase invalidates every auth
 * token on a password change, so re-authenticate right after.
 * Returns an error message, or null on success.
 */
export async function changePassword(oldPassword: string, password: string): Promise<string | null> {
  const record = pb.authStore.record;
  if (!record) return "Not signed in.";
  try {
    await pb
      .collection("users")
      .update(record.id, { oldPassword, password, passwordConfirm: password });
    await pb.collection("users").authWithPassword(record.email as string, password);
    useUi.getState().pushToast("Password changed.");
    return null;
  } catch (e) {
    if (e instanceof ClientResponseError) {
      const data = e.response?.data as Record<string, { message?: string }> | undefined;
      if (data?.oldPassword) return "Current password is incorrect.";
      const field = data && Object.values(data)[0]?.message;
      if (field) return field;
      if (e.status === 0) return "Cannot reach the sync server.";
    }
    return "Could not change the password.";
  }
}

/**
 * Delete every track - synced records and local data. The account (if any)
 * stays. Returns an error message, or null on success.
 */
export async function deleteAllData(): Promise<string | null> {
  if (timer) clearTimeout(timer);
  const ui = useUi.getState();
  if (ui.account && pb.authStore.isValid) {
    ui.setSyncBusy(true);
    try {
      const records = await pb.collection(COLLECTION).getFullList({ fields: "id" });
      for (const r of records) await pb.collection(COLLECTION).delete(r.id);
    } catch (e) {
      console.error("[sync] delete all data failed", e);
      return "Could not delete the synced data. Check the connection and try again.";
    } finally {
      ui.setSyncBusy(false);
    }
  }
  await wipeLocalData();
  useUi.getState().pushToast("All data deleted.");
  return null;
}

/**
 * Permanently delete the account; the tracks collection cascade-deletes with
 * it. Local data is wiped too. Returns an error message, or null on success.
 */
export async function deleteAccount(): Promise<string | null> {
  const record = pb.authStore.record;
  if (!record) return "Not signed in.";
  if (timer) clearTimeout(timer);
  try {
    await pb.collection("users").delete(record.id);
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 0) return "Cannot reach the sync server.";
    return "Could not delete the account.";
  }
  pb.authStore.clear();
  useUi.getState().setAccount(null);
  useUi.getState().setAccountMenuOpen(false);
  await wipeLocalData();
  useUi.getState().pushToast("Account deleted.");
  return null;
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
    // server unreachable - keep the cached session and try to work offline
  }
  const record = pb.authStore.record;
  useUi
    .getState()
    .setAccount({ id: record.id, email: record.email as string, premium: !!record.premium });
  try {
    const saved = await fetchAccountTracks();
    applyLibrary(saved);
  } catch {
    // offline: leave whatever is local
  }
  startSync();
  return true;
}
