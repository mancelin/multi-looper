"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { MIN_SEGMENT, segmentIndexAt } from "@/lib/extraMedia";
import {
  moveSegmentBoundary,
  nudgeSegmentEdge,
  seekToSegment,
  splitAtPlayhead,
} from "@/lib/extraMediaEdit";
import { player } from "@/lib/player/controller";
import { fmt, fmtS } from "@/lib/time";
import type { ExtraMediaSegment, Track } from "@/lib/types";
import { useUi } from "@/store/ui";

/** Nudge step for the precise controls, in seconds. */
const STEP = 0.1;

const TINT: Record<string, string> = {
  image: "#93c5fd",
  markdown: "#c4b5fd",
  empty: "#5b6472",
};

const kindOf = (s: ExtraMediaSegment) => s.media?.type ?? "empty";

const nameOf = (s: ExtraMediaSegment) =>
  s.media?.type === "markdown"
    ? (s.media.text.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").slice(0, 40) ||
      "Notes")
    : s.media?.type === "image"
      ? "Image"
      : "No media yet";

/**
 * The foldable "extra media times" menu: the track's extra-media segments as
 * a proportional strip whose shared edges are dragged to retime them. Because
 * the segments partition the track, an edge belongs to the two segments it
 * separates and moving it retimes both — there is no way to open a gap or an
 * overlap, which is the whole point of editing it here rather than with two
 * independent handles per segment.
 *
 * The playhead moves at frame rate, so it is positioned imperatively through
 * `player.onTime()` and never via React state — same rule as the waveform.
 */
export function ExtraMediaTimes({ track }: { track: Track }) {
  const open = useUi((s) => s.extraTimesOpen);
  const toggle = useUi((s) => s.toggleExtraTimes);
  const stripRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number | "head"; rect: DOMRect } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  const segs = track.extraMedia;
  const d = track.duration || 1;

  // The playhead moves every frame but only two things about it can change
  // what React renders: which segment it is inside (the default selection)
  // and whether there is room to split where it stands. Watch for those two
  // and paint the marker itself straight onto the node.
  const [head, setHead] = useState<{ id: string | null; canSplit: boolean }>({
    id: null,
    canSplit: false,
  });
  useEffect(() => {
    let last = "";
    const update = (t: number) => {
      if (headRef.current) headRef.current.style.left = `${(t / d) * 100}%`;
      const i = segmentIndexAt(segs, t);
      const id = i < 0 ? null : segs![i].id;
      const canSplit =
        i >= 0 && t - segs![i].start >= MIN_SEGMENT && segs![i].end - t >= MIN_SEGMENT;
      const key = `${id}:${canSplit}`;
      if (key !== last) {
        last = key;
        setHead({ id, canSplit });
      }
    };
    update(player.getT());
    return player.onTime(update);
  }, [segs, d, open]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = dragRef.current;
      if (!g || !g.rect.width) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - g.rect.left) / g.rect.width));
      const t = ratio * d;
      if (g.index === "head") player.setT(t);
      else moveSegmentBoundary(track.id, g.index, t);
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [track.id, d]);

  if (!segs?.length) return null;

  const sel = segs.find((s) => s.id === selId) ?? segs.find((s) => s.id === head.id) ?? segs[0];
  const selIdx = segs.indexOf(sel);
  const firstSel = selIdx === 0;
  const lastSel = selIdx === segs.length - 1;

  // The strip is what the drag ratio is measured against, so its box is
  // captured once per gesture rather than read on every pointer move.
  const startDrag = (index: number | "head", e: React.PointerEvent) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    dragRef.current = { index, rect };
  };

  const pick = (s: ExtraMediaSegment) => {
    setSelId(s.id);
    seekToSegment(s);
  };

  const nudgeBtn =
    "flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[6px] border border-white/10 bg-field-2 text-[13px] leading-none text-muted disabled:cursor-not-allowed disabled:text-muted-5";

  return (
    <div className="px-4 pt-3 sm:px-[26px]">
      <div className="rounded-[12px] border border-white/8 bg-panel-2">
        <div className="flex items-center gap-[11px] px-[14px] py-[7px]">
          <button
            onClick={toggle}
            data-testid="extra-times-toggle"
            title={open ? "Hide extra media times" : "Show extra media times"}
            aria-expanded={open}
            className="flex flex-1 cursor-pointer items-center gap-[11px] border-none bg-transparent p-0 text-left"
          >
            <span
              className="flex h-[18px] w-[18px] items-center justify-center text-muted transition-transform"
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="flex items-baseline gap-[9px]">
              <span className="text-[9.5px] font-semibold tracking-[.1em] text-muted-3">
                EXTRA MEDIA TIMES
              </span>
              <span className="tno text-[10px] text-muted-5">
                {segs.length} {segs.length === 1 ? "segment" : "segments"}
              </span>
            </span>
          </button>
          <button
            onClick={() => splitAtPlayhead(track.id)}
            disabled={!head.canSplit}
            data-testid="add-extra-media"
            title={
              head.canSplit
                ? "Add a segment starting at the playhead"
                : "Too close to an edge to add a segment here"
            }
            className="flex h-[27px] flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border border-dashed border-[rgba(94,234,212,.4)] bg-[rgba(94,234,212,.05)] px-[12px] text-[12px] font-semibold text-accent disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-muted-3"
          >
            <PlusIcon />
            <span className="hidden min-[480px]:inline">Add at playhead</span>
          </button>
        </div>

        {open && (
          <div className="px-[14px] pb-[14px] pt-[2px]">
            <div
              onPointerDown={(e) => startDrag("head", e)}
              onClick={(e) => {
                const rect = stripRef.current?.getBoundingClientRect();
                if (rect?.width) player.setT(((e.clientX - rect.left) / rect.width) * d);
              }}
              title="Click or drag to move the playhead"
              data-testid="extra-times-ruler"
              className="relative h-4 cursor-pointer touch-none"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="tno absolute top-0 text-[9.5px] text-muted-5"
                  style={{
                    left: `${i * 25}%`,
                    transform: i === 0 ? "none" : i === 4 ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {fmtS((d / 4) * i)}
                </span>
              ))}
            </div>
            <div ref={stripRef} className="relative mt-1" data-testid="extra-times-strip">
              <div className="flex h-12 overflow-hidden rounded-[10px] border border-white/8">
                {segs.map((s) => {
                  const active = s.id === sel.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => pick(s)}
                      title={`${fmtS(s.start)} – ${fmtS(s.end)}`}
                      data-testid="extra-segment"
                      className="flex min-w-0 cursor-pointer flex-col justify-center gap-[2px] px-[11px]"
                      style={{
                        width: `${((s.end - s.start) / d) * 100}%`,
                        background: active ? "rgba(94,234,212,.12)" : "#14171d",
                        boxShadow: active
                          ? `inset 0 0 0 1px ${track.accent}`
                          : "inset -1px 0 0 rgba(255,255,255,.07)",
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-[6px]">
                        <span
                          className="h-[7px] w-[7px] flex-none rounded-full"
                          style={{ background: TINT[kindOf(s)] }}
                        />
                        <span
                          className="truncate text-[12.5px] font-semibold"
                          style={{ color: active ? "#ffffff" : "#b8bfca" }}
                        >
                          {nameOf(s)}
                        </span>
                      </span>
                      <span className="tno truncate text-[10px] text-muted-2">
                        {fmtS(s.start)} – {fmtS(s.end)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* shared edges: one handle per boundary, retiming both neighbours */}
              {segs.slice(0, -1).map((s, i) => (
                <div
                  key={`b${s.id}`}
                  onPointerDown={(e) => startDrag(i, e)}
                  title={`Drag to retime — ${fmtS(s.end)}`}
                  data-testid="extra-boundary"
                  className="group absolute -top-[6px] bottom-[-6px] z-2 -ml-2 flex w-4 touch-none cursor-col-resize items-center justify-center"
                  style={{ left: `${(s.end / d) * 100}%` }}
                >
                  <div className="h-full w-[2px] rounded-[1px] bg-white/25 transition-colors group-hover:w-[3px] group-hover:bg-accent" />
                </div>
              ))}

              <div
                ref={headRef}
                aria-hidden
                className="pointer-events-none absolute -top-[6px] bottom-[-6px] z-1 -ml-px w-[2px] bg-playhead"
              />
            </div>

            <div className="mt-[13px] flex flex-wrap items-stretch gap-[10px]">
              <div className="flex flex-wrap items-center gap-x-[14px] gap-y-2 rounded-[11px] border border-white/8 bg-panel px-[15px] py-[8px]">
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[9.5px] font-semibold tracking-[.1em] text-accent">
                    STARTS
                  </span>
                  <div className="flex items-center gap-[6px]">
                    <button
                      onClick={() => nudgeSegmentEdge(track.id, sel.id, "start", -STEP)}
                      disabled={firstSel}
                      title="−100ms"
                      className={nudgeBtn}
                    >
                      −
                    </button>
                    <span
                      data-testid="segment-start"
                      className="tno w-[82px] rounded-[7px] border border-white/9 bg-field-2 py-[3px] text-center text-[16px] font-semibold"
                      style={{ color: firstSel ? "#4b5563" : "#e7eaf0" }}
                    >
                      {fmt(sel.start)}
                    </span>
                    <button
                      onClick={() => nudgeSegmentEdge(track.id, sel.id, "start", STEP)}
                      disabled={firstSel}
                      title="+100ms"
                      className={nudgeBtn}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="w-px self-stretch bg-white/8 max-sm:hidden" />
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[9.5px] font-semibold tracking-[.1em] text-accent">
                    ENDS
                  </span>
                  <div className="flex items-center gap-[6px]">
                    <button
                      onClick={() => nudgeSegmentEdge(track.id, sel.id, "end", -STEP)}
                      disabled={lastSel}
                      title="−100ms"
                      className={nudgeBtn}
                    >
                      −
                    </button>
                    <span
                      data-testid="segment-end"
                      className="tno w-[82px] rounded-[7px] border border-white/9 bg-field-2 py-[3px] text-center text-[16px] font-semibold"
                      style={{ color: lastSel ? "#4b5563" : "#e7eaf0" }}
                    >
                      {fmt(sel.end)}
                    </span>
                    <button
                      onClick={() => nudgeSegmentEdge(track.id, sel.id, "end", STEP)}
                      disabled={lastSel}
                      title="+100ms"
                      className={nudgeBtn}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="w-px self-stretch bg-white/8 max-sm:hidden" />
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[9.5px] font-semibold tracking-[.1em] text-muted-3">
                    LENGTH
                  </span>
                  <span className="tno text-[16px] font-semibold text-ink">
                    {fmt(sel.end - sel.start)}
                  </span>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-[9px] rounded-[11px] border border-white/8 bg-panel px-[14px] py-[8px]">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: TINT[kindOf(sel)] }}
                />
                <span className="truncate text-[13px] font-semibold text-ink">{nameOf(sel)}</span>
                <span className="flex-none rounded-[6px] bg-white/5 px-[7px] py-[2px] text-[9.5px] font-semibold tracking-[.08em] text-muted-2">
                  {kindOf(sel) === "markdown" ? "NOTES" : kindOf(sel).toUpperCase()}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() =>
                    useUi.getState().askRemoveExtraMedia(track.id, sel.id, "segment")
                  }
                  data-testid="delete-segment"
                  title={
                    segs.length === 1
                      ? "Delete this segment — the track keeps no extra media"
                      : "Delete this segment — its time goes back to the neighbour"
                  }
                  className="h-[28px] flex-none cursor-pointer rounded-[8px] border border-white/10 bg-white/4 px-[11px] text-[11.5px] font-semibold text-ink-2 hover:border-danger hover:text-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
