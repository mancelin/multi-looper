/**
 * Per-track extra-media panel height overrides. Heights are only meaningful
 * for the window size they were chosen at, so the whole record is stamped
 * with the window dimensions and discarded wholesale when they no longer
 * match.
 */

const KEY = "multilooper_extra_media_heights";

interface Stored {
  win: { w: number; h: number };
  heights: Record<string, number>; // track id -> extra-media box height (px)
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function winMatches(s: Stored): boolean {
  return s.win?.w === window.innerWidth && s.win?.h === window.innerHeight;
}

export function loadExtraMediaHeight(trackId: string): number | null {
  const s = read();
  if (!s || !winMatches(s)) return null;
  return s.heights[trackId] ?? null;
}

export function saveExtraMediaHeight(trackId: string, height: number): void {
  const prev = read();
  const heights = prev && winMatches(prev) ? prev.heights : {};
  heights[trackId] = Math.round(height);
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ win: { w: window.innerWidth, h: window.innerHeight }, heights }),
    );
  } catch {
    // storage unavailable - the resize still applies for this session
  }
}

export function clearExtraMediaHeights(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
