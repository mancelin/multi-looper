"use client";

import { useUi } from "@/store/ui";

/**
 * TIDAL source support. Playback goes through the official TIDAL Web SDK
 * (@tidal-music/player) and requires the user to connect their tidal.com
 * account (OAuth authorization-code flow via @tidal-music/auth). The app
 * itself needs a client id registered at https://developer.tidal.com/dashboard
 * whose redirect URI matches this app's origin.
 */

export const TIDAL_PLACEHOLDER_TITLE = "TIDAL loop";

/** localStorage flag set while the OAuth redirect round-trip is in flight. */
const LOGIN_PENDING_KEY = "multilooper_tidal_login";
const STORAGE_KEY = "multilooper_tidal";

export function tidalClientId(): string {
  return process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID ?? "";
}

/** True when the app is configured with a TIDAL client id. */
export function tidalConfigured(): boolean {
  return !!tidalClientId();
}

export function extractTidalTrackId(input: string): string | null {
  const u = input.trim();
  if (!u) return null;
  // tidal.com/track/123, tidal.com/browse/track/123, listen.tidal.com/track/123
  const m = u.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/);
  return m ? m[1] : null;
}

/** Synthetic waveform for TIDAL tracks (no audio data available client-side). */
export function syntheticTidalPeaks(trackId: string, n = 600): number[] {
  const seed = Number(trackId.slice(-4)) || 7;
  return Array.from({ length: n }, (_, i) => {
    const x = i / n;
    return Math.max(
      0.06,
      Math.min(
        1,
        (0.3 + 0.7 * Math.abs(Math.sin(i / 6 + seed))) *
          Math.min(1, Math.sin(x * Math.PI) * 1.3 + 0.2),
      ),
    );
  });
}

// ---------- auth ----------

type AuthModule = typeof import("@tidal-music/auth");

let authInit: Promise<AuthModule> | null = null;

/** Lazy-load and initialize the TIDAL auth module (idempotent). */
async function ensureAuth(): Promise<AuthModule> {
  if (!authInit) {
    authInit = (async () => {
      const auth = await import("@tidal-music/auth");
      await auth.init({
        clientId: tidalClientId(),
        credentialsStorageKey: STORAGE_KEY,
        // must match the "Allowed scopes" of the app registered in the
        // TIDAL dashboard — an empty scope request errors on login.tidal.com
        scopes: ["playback"],
      });
      return auth;
    })();
  }
  return authInit;
}

/** The SDK credentials provider, for wiring into the player module. */
export async function tidalCredentialsProvider() {
  const auth = await ensureAuth();
  return auth.credentialsProvider;
}

/** Access token of the connected user, or null when not connected. */
export async function tidalToken(): Promise<string | null> {
  if (!tidalConfigured()) return null;
  try {
    const auth = await ensureAuth();
    const c = await auth.credentialsProvider.getCredentials();
    // userId is only present on user-login tokens (not client credentials)
    return c.token && c.userId ? c.token : null;
  } catch {
    return null;
  }
}

/** Starts the OAuth redirect flow (leaves the page). */
export async function connectTidal(): Promise<void> {
  const auth = await ensureAuth();
  // always the app root — must byte-match the redirect URI registered in the
  // TIDAL dashboard, and the app may sit on a track path like /2 when clicked
  const redirectUri = window.location.origin + "/";
  try {
    localStorage.setItem(LOGIN_PENDING_KEY, redirectUri);
  } catch {}
  const loginUrl = await auth.initializeLogin({ redirectUri });
  window.location.assign(loginUrl);
}

export async function disconnectTidal(): Promise<void> {
  try {
    const auth = await ensureAuth();
    auth.logout();
  } catch {}
  useUi.getState().setTidalConnected(false);
}

/**
 * Boot hook: finalizes a pending OAuth redirect (code in the query string)
 * and publishes the connected state to the UI store.
 */
export async function bootTidal(): Promise<void> {
  if (!tidalConfigured()) return;
  let pending: string | null = null;
  try {
    pending = localStorage.getItem(LOGIN_PENDING_KEY);
  } catch {}
  if (pending && /[?&]code=/.test(window.location.search)) {
    try {
      const auth = await ensureAuth();
      await auth.finalizeLogin(window.location.search);
    } catch {
      // login cancelled or code rejected — stay disconnected
    }
    try {
      localStorage.removeItem(LOGIN_PENDING_KEY);
    } catch {}
    // drop the consumed OAuth params from the address bar
    window.history.replaceState(null, "", window.location.pathname);
  }
  useUi.getState().setTidalConnected(!!(await tidalToken()));
}

// ---------- metadata ----------

export interface TidalMeta {
  title?: string;
  artist?: string;
  duration?: number;
  cover?: string;
}

/** Parses an ISO 8601 duration ("PT4M4S") into seconds. */
function isoDurationSeconds(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return undefined;
  const m = v.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return undefined;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s > 0 ? s : undefined;
}

interface JsonApiResource {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Fetches track title/artist/duration/cover from the TIDAL open API.
 * Best-effort: returns null when not connected or on any failure — the
 * track keeps its placeholder metadata (duration is patched at playback).
 */
export async function fetchTidalMeta(trackId: string): Promise<TidalMeta | null> {
  const token = await tidalToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://openapi.tidal.com/v2/tracks/${trackId}?countryCode=US&include=artists,albums`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: JsonApiResource; included?: JsonApiResource[] };
    const attrs = body.data?.attributes ?? {};
    const included = body.included ?? [];
    const artist = included
      .filter((r) => r.type === "artists")
      .map((r) => r.attributes?.name)
      .filter((n): n is string => typeof n === "string")
      .join(", ");
    // album imageLinks: pick a mid-size cover (~320px) when present
    let cover: string | undefined;
    const album = included.find((r) => r.type === "albums");
    const links = album?.attributes?.imageLinks;
    if (Array.isArray(links)) {
      const sized = links
        .filter((l) => typeof l?.href === "string")
        .sort(
          (a, b) =>
            Math.abs(((a.meta?.width as number) ?? 9999) - 320) -
            Math.abs(((b.meta?.width as number) ?? 9999) - 320),
        );
      cover = sized[0]?.href as string | undefined;
    }
    return {
      title: typeof attrs.title === "string" ? attrs.title : undefined,
      artist: artist || undefined,
      duration: isoDurationSeconds(attrs.duration),
      cover,
    };
  } catch {
    return null;
  }
}
