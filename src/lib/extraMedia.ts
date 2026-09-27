import { uid, type ExtraMedia, type ExtraMediaSegment } from "./types";

/**
 * Pure segment math for the extra-media partition. Segments always cover
 * `[0, duration]` with no gaps and no overlaps, so every operation here takes
 * a partition and returns a partition - callers never patch `start`/`end`
 * directly. Store-bound wrappers live in `extraMediaEdit.ts`.
 */

/**
 * Smallest stretch an edit will leave behind. Deliberately short: tracks can
 * be a few seconds long (a mic take), so a floor in whole seconds would make
 * splitting impossible on exactly the material people record.
 */
export const MIN_SEGMENT = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The segment showing at `t`; the last one owns the closing instant. */
export function segmentAt(
  segs: ExtraMediaSegment[] | undefined,
  t: number,
): ExtraMediaSegment | undefined {
  if (!segs?.length) return undefined;
  return segs.find((s) => t < s.end) ?? segs[segs.length - 1];
}

export function segmentIndexAt(segs: ExtraMediaSegment[] | undefined, t: number): number {
  if (!segs?.length) return -1;
  const i = segs.findIndex((s) => t < s.end);
  return i === -1 ? segs.length - 1 : i;
}

/** The whole track as a single segment - what the first added media gets. */
export function fullSpan(duration: number, media?: ExtraMedia): ExtraMediaSegment[] {
  return [{ id: uid("em"), start: 0, end: Math.max(MIN_SEGMENT, duration), media }];
}

/**
 * Boundary `i` is the shared edge between segment `i` and `i + 1`: moving it
 * ends the left segment and starts the right one in the same step, which is
 * what keeps the partition gapless. Refused rather than clamped when the
 * neighbours have no room left.
 */
export function moveBoundary(
  segs: ExtraMediaSegment[],
  i: number,
  t: number,
): ExtraMediaSegment[] {
  if (i < 0 || i >= segs.length - 1) return segs;
  const lo = segs[i].start + MIN_SEGMENT;
  const hi = segs[i + 1].end - MIN_SEGMENT;
  if (hi < lo) return segs;
  const v = clamp(t, lo, hi);
  if (v === segs[i].end) return segs;
  const out = segs.slice();
  out[i] = { ...out[i], end: v };
  out[i + 1] = { ...out[i + 1], start: v };
  return out;
}

/**
 * Carve the segment holding `t` in two at `t`. The left half keeps the media,
 * the right half is created empty. Returns the same array when there isn't
 * room for two segments.
 */
export function splitAt(segs: ExtraMediaSegment[], t: number): ExtraMediaSegment[] {
  const i = segmentIndexAt(segs, t);
  if (i < 0) return segs;
  const s = segs[i];
  if (t - s.start < MIN_SEGMENT || s.end - t < MIN_SEGMENT) return segs;
  const out = segs.slice();
  out.splice(i, 1, { ...s, end: t }, { id: uid("em"), start: t, end: s.end });
  return out;
}

/**
 * Drop a segment, handing its time to the neighbour before it (or after it,
 * for the first). Removing the only segment leaves the track with no extra
 * media at all.
 */
export function mergeSegment(segs: ExtraMediaSegment[], id: string): ExtraMediaSegment[] {
  const i = segs.findIndex((s) => s.id === id);
  if (i < 0) return segs;
  if (segs.length === 1) return [];
  const out = segs.slice();
  if (i === 0) out[1] = { ...out[1], start: out[0].start };
  else out[i - 1] = { ...out[i - 1], end: out[i].end };
  out.splice(i, 1);
  return out;
}

/**
 * Re-span the partition onto a new duration - real durations arrive late
 * (YouTube placeholder, failed decode), so this runs from `patchDuration` and
 * doubles as the repair for anything that reaches us mis-shaped. Inner
 * boundaries stay where they are; the last segment takes up the slack.
 */
export function clampSegments(
  segs: ExtraMediaSegment[] | undefined,
  duration: number,
): ExtraMediaSegment[] | undefined {
  if (!segs?.length) return segs;
  const d = Math.max(MIN_SEGMENT, duration);
  const out: ExtraMediaSegment[] = [];
  let prev = 0;
  for (const s of segs) {
    const end = Math.min(s.end, d);
    // a shorter track can squeeze trailing segments out entirely
    if (end - prev < MIN_SEGMENT) continue;
    out.push({ ...s, start: prev, end });
    prev = end;
  }
  if (!out.length) return [{ ...segs[0], start: 0, end: d }];
  out[out.length - 1] = { ...out[out.length - 1], end: d };
  return out;
}
