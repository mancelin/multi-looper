"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, NoteIcon, SearchIcon } from "@/components/icons";
import { player } from "@/lib/player/controller";
import { fmtS } from "@/lib/time";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

/** Pointer travel (px) that turns a mouse press into a drag. */
const MOUSE_DRAG_SLOP = 5;
/** Touch press (ms) that starts a drag; below it the list still scrolls normally. */
const TOUCH_HOLD_MS = 350;
/** Distance from the list edges (px) where a drag auto-scrolls. */
const EDGE = 44;

// Non-passive so it can actually stop the page from scrolling under a touch drag.
function blockTouchScroll(e: TouchEvent) {
  e.preventDefault();
}

interface Gesture {
  id: string;
  x: number;
  y: number;
  pointerId: number;
  timer: ReturnType<typeof setTimeout> | null;
  dragging: boolean;
}

interface Drop {
  id: string;
  after: boolean;
}

export function Sidebar() {
  const tracks = useLibrary((s) => s.tracks);
  const currentId = useLibrary((s) => s.currentId);
  const search = useLibrary((s) => s.search);
  const setSearch = useLibrary((s) => s.setSearch);
  const reorderTracks = useLibrary((s) => s.reorderTracks);
  const askRemoveTrack = useUi((s) => s.askRemoveTrack);
  const narrow = useUi((s) => s.narrow);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const toggleSidebar = useUi((s) => s.toggleSidebar);

  const listRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const dropRef = useRef<Drop | null>(null);
  const scrollDir = useRef(0);
  const raf = useRef(0);
  // a drag ends with a click on the row it started from - that must not select it
  const suppressClick = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  const stopAutoScroll = () => {
    scrollDir.current = 0;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  };

  const endGesture = () => {
    const g = gesture.current;
    if (g?.timer) clearTimeout(g.timer);
    gesture.current = null;
    dropRef.current = null;
    setDragId(null);
    setDrop(null);
    stopAutoScroll();
    document.removeEventListener("touchmove", blockTouchScroll);
  };

  useEffect(() => endGesture, []); // eslint-disable-line react-hooks/exhaustive-deps

  const beginDrag = (g: Gesture) => {
    g.timer = null;
    g.dragging = true;
    setDragId(g.id);
    document.addEventListener("touchmove", blockTouchScroll, { passive: false });
    const step = () => {
      const el = listRef.current;
      if (el && scrollDir.current) el.scrollTop += scrollDir.current * 9;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // remove button
    // a drag that ended over another row never produces a click - clear the flag here
    suppressClick.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const g: Gesture = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, timer: null, dragging: false };
    gesture.current = g;
    if (e.pointerType !== "mouse") {
      g.timer = setTimeout(() => beginDrag(g), TOUCH_HOLD_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (!g.dragging) {
      const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
      if (e.pointerType === "mouse") {
        if (moved > MOUSE_DRAG_SLOP) beginDrag(g);
      } else if (moved > 10) {
        endGesture(); // the finger is scrolling, not dragging
      }
      return;
    }

    const row = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(
      "[data-track-id]",
    ) as HTMLElement | null;
    if (row) {
      const r = row.getBoundingClientRect();
      const next: Drop = { id: row.dataset.trackId!, after: e.clientY > r.top + r.height / 2 };
      if (next.id !== dropRef.current?.id || next.after !== dropRef.current.after) {
        dropRef.current = next;
        setDrop(next);
      }
    }

    const box = listRef.current?.getBoundingClientRect();
    scrollDir.current = !box
      ? 0
      : e.clientY < box.top + EDGE
        ? -1
        : e.clientY > box.bottom - EDGE
          ? 1
          : 0;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const target = dropRef.current;
    if (g.dragging) {
      suppressClick.current = true;
      if (target && target.id !== g.id) reorderTracks(g.id, target.id, target.after);
    }
    endGesture();
  };

  if (!sidebarOpen || tracks.length === 0) return null;

  const q = search.trim().toLowerCase();
  const filtered = tracks.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.artist || "").toLowerCase().includes(q) ||
      t.tags.some((x) => x.toLowerCase().includes(q)),
  );

  return (
    <>
      {narrow && (
        <div className="fixed inset-0 top-[58px] z-30 bg-black/55" onClick={toggleSidebar} />
      )}
      <aside
        className={
          narrow
            ? "fixed bottom-0 left-0 top-[58px] z-40 flex w-[280px] max-w-[80vw] flex-col border-r border-white/7 bg-panel"
            : "flex min-h-0 w-[300px] flex-none flex-col border-r border-white/7 bg-panel"
        }
      >
      <div className="flex-none px-[14px] pb-[10px] pt-[14px]">
        <div className="mb-[11px] flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[.13em] text-muted-3">LIBRARY</span>
          <span className="tno text-[11px] text-muted-5">{tracks.length}</span>
        </div>
        <div className="flex h-[34px] items-center gap-2 rounded-[8px] border border-white/8 bg-field px-[10px]">
          <SearchIcon className="flex-none text-muted-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loops & tags"
            className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-ink"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="flex-none rounded-[4px] p-[2px] text-muted-4 hover:text-ink"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>
      </div>
      <div
        ref={listRef}
        className={`flex-1 overflow-y-auto px-2 pb-[14px] pt-[2px] ${dragId ? "select-none" : ""}`}
      >
        {filtered.map((t) => {
          const active = t.id === currentId;
          const dragging = t.id === dragId;
          const marker = dragId && drop?.id === t.id && drop.id !== dragId ? drop : null;
          return (
            <div
              key={t.id}
              data-track-id={t.id}
              onPointerDown={(e) => onPointerDown(e, t.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={endGesture}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                player.selectTrack(t.id);
                if (narrow) toggleSidebar();
              }}
              className="relative mb-[3px] flex cursor-pointer gap-[11px] rounded-[10px] border p-[10px]"
              style={{
                background: active ? "rgba(94,234,212,.08)" : "transparent",
                borderColor: active ? "rgba(94,234,212,.28)" : "transparent",
                opacity: dragging ? 0.4 : 1,
                touchAction: dragId ? "none" : undefined,
              }}
            >
              {marker && (
                <div
                  data-testid="drop-marker"
                  className="pointer-events-none absolute left-[4px] right-[4px] h-[2px] rounded-full bg-[#5eead4]"
                  style={marker.after ? { bottom: -3 } : { top: -3 }}
                />
              )}
              <div
                className="absolute bottom-[9px] left-0 top-[9px] w-[3px] rounded-[3px]"
                style={{ background: active ? t.accent : "transparent" }}
              />
              <div className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[7px] bg-field-2">
                {t.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumb} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <span className="flex" style={{ color: t.accent }}>
                    <NoteIcon />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
                <span
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold"
                  style={{ color: active ? "#ffffff" : "#d5dae2" }}
                >
                  {t.title}
                </span>
                <div className="flex items-center gap-[7px] text-[11px] text-muted-3">
                  <span className="tno">{fmtS(t.duration || 0)}</span>
                  <span className="h-[3px] w-[3px] rounded-full bg-[#3a4150]" />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t.artist}</span>
                </div>
                {t.tags.length > 0 && (
                  <div className="mt-[1px] flex flex-wrap gap-[5px]">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[5px] border border-white/6 bg-white/5 px-[6px] py-[1px] text-[9.5px] tracking-[.03em] text-muted-2"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  askRemoveTrack(t.id);
                }}
                title="Remove"
                className="flex h-[22px] w-[22px] flex-none cursor-pointer items-center justify-center self-start rounded-[6px] border-none bg-transparent text-muted-5 hover:bg-[rgba(248,113,113,.1)] hover:text-danger"
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}
      </div>
      </aside>
    </>
  );
}
