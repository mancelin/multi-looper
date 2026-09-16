"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, PencilIcon, ResizeIcon, TextIcon, UploadIcon } from "@/components/icons";
import { segmentAt } from "@/lib/extraMedia";
import { clearSegmentMedia, ensureSegment, setSegmentMedia } from "@/lib/extraMediaEdit";
import {
  clearExtraMediaHeights,
  loadExtraMediaHeight,
  saveExtraMediaHeight,
} from "@/lib/extraMediaSize";
import { imageFileToDataUrl } from "@/lib/image";
import { player } from "@/lib/player/controller";
import type { Track } from "@/lib/types";
import { useUi } from "@/store/ui";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownView } from "./MarkdownView";

const MIN_HEIGHT = 72;

// Phone layout: the column has no leftover height to hand out, so a panel that
// asks to fill it (`flex-1`) is squeezed to its min-height — or, in the
// editor's case, to nothing, leaving its content painting over the waveform.
// Below `sm` the panel is sized by its own content and the page scrolls
// instead; `CAP` keeps a long note or a tall image from pushing the transport
// off-screen.
const FILL = "flex-1 max-sm:flex-none";
const CAP = "max-sm:max-h-[50svh]";
// Edit/remove/resize live in the panel's corners and fade in on hover. A touch
// screen has no hover, so there they are always on — otherwise a phone can
// neither re-edit nor clear a note once it is saved.
const TOUCH_SHOW = "[@media(hover:none)]:opacity-100";

// Two standalone buttons rather than one strip split in half: separate
// objects with an "or" between them read as alternatives, where a divided
// strip reads as two slots that could both be filled.
const hintChoice =
  "flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-white/10 bg-field px-4 py-3 text-center transition-colors hover:border-white/25 hover:bg-field-2";

/**
 * Extra media for any track — file or YouTube — shown above the video panel:
 * an image (sheet music, album art) or markdown notes (chords, lyrics). Which
 * one is showing depends on the playhead: `track.extraMedia` partitions the
 * track into segments and this panel renders the one the playhead is inside.
 * `ExtraMediaTimes` is where those times are edited. A segment holds one
 * medium at a time; adding one replaces the other.
 *
 * Height: both media kinds fill the leftover column height by default — an
 * image and a note therefore occupy the same box, so switching between them
 * never shifts the video, waveform or transport below. Dragging the corner
 * grip pins a fixed height, remembered per track until the window is resized
 * — a resize resets every track to auto.
 */
export function ExtraMediaPanel({ track }: { track: Track }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const segs = track.extraMedia;
  const [sized, setSized] = useState<{ id: string; height: number | null }>(() => ({
    id: track.id,
    height: loadExtraMediaHeight(track.id),
  }));
  const [editId, setEditId] = useState<string | null>(null);
  // Reset during render when the track changes (avoids a one-frame flash of
  // the previous track's height that an effect-based reset would show).
  if (sized.id !== track.id) {
    setSized({ id: track.id, height: loadExtraMediaHeight(track.id) });
  }
  const height = sized.id === track.id ? sized.height : loadExtraMediaHeight(track.id);
  const setHeight = (h: number | null) => setSized({ id: track.id, height: h });

  // Which segment is showing follows the playhead, which moves at frame rate —
  // so watch it imperatively and only re-render when it crosses a boundary.
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    let last: string | null = null;
    const update = (t: number) => {
      const id = segmentAt(segs, t)?.id ?? null;
      if (id !== last) {
        last = id;
        setActiveId(id);
      }
    };
    update(player.getT());
    return player.onTime(update);
  }, [segs]);

  useEffect(() => {
    const onResize = () => {
      clearExtraMediaHeights();
      setSized((s) => ({ ...s, height: null }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const seg = segs?.find((s) => s.id === activeId) ?? segs?.[0];
  const media = seg?.media;

  // ---------- editing notes ----------

  if (seg && editId === seg.id) {
    const onSave = (text: string) => {
      if (text.trim()) setSegmentMedia(track.id, seg.id, { type: "markdown", text });
      else clearSegmentMedia(track.id, seg.id);
      setEditId(null);
    };
    // Backing out of the editor on a segment the click itself created leaves
    // nothing behind, rather than an empty segment the user never asked for.
    const onCancel = () => {
      if (!media) clearSegmentMedia(track.id, seg.id);
      setEditId(null);
    };
    return (
      <div
        style={height !== null ? { height } : undefined}
        className={`flex min-h-0 px-4 pb-1 pt-[6px] sm:px-[26px] ${
          height === null ? FILL : "flex-none"
        }`}
      >
        <MarkdownEditor
          initial={media?.type === "markdown" ? media.text : ""}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    );
  }

  // ---------- nothing set: hint strip ----------

  if (!media) {
    const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const src = await imageFileToDataUrl(file);
        setSegmentMedia(track.id, seg?.id ?? null, { type: "image", src });
      } catch {
        // undecodable image — ignore
      }
    };
    const startNotes = () => setEditId(seg?.id ?? ensureSegment(track.id));
    return (
      <div className="px-4 pb-1 pt-[6px] sm:px-[26px]">
        <div data-testid="extra-media-hint" className="flex w-full items-stretch gap-3">
          <label title="Add image" className={hintChoice}>
            <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <UploadIcon size={14} />
              Add image
            </span>
            <span className="text-[10.5px] text-muted-4">click, drag &amp; drop, or paste</span>
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
          </label>
          <span className="select-none self-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-4">
            or
          </span>
          <button
            type="button"
            title="Add notes"
            data-testid="add-notes"
            onClick={startNotes}
            className={hintChoice}
          >
            <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <TextIcon size={14} />
              Add notes
            </span>
            <span className="text-[10.5px] text-muted-4">markdown</span>
          </button>
        </div>
      </div>
    );
  }

  const onResizeGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    const startY = e.clientY;
    const startH = boxRef.current?.getBoundingClientRect().height ?? MIN_HEIGHT;
    const maxH = Math.round(window.innerHeight * 0.8);
    let h = startH;
    const move = (ev: PointerEvent) => {
      h = Math.max(MIN_HEIGHT, Math.min(maxH, Math.round(startH + (ev.clientY - startY))));
      setHeight(h);
    };
    const up = () => {
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {}
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      saveExtraMediaHeight(track.id, h);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };

  const remove = () => useUi.getState().askRemoveExtraMedia(track.id, seg.id);

  const grip = (
    <div
      onPointerDown={onResizeGrip}
      title="Drag to resize"
      data-testid="extra-media-resize-grip"
      className={`absolute bottom-0 right-0 z-6 flex h-6 w-6 cursor-nwse-resize touch-none items-end justify-end rounded-br-[12px] bg-[linear-gradient(135deg,transparent_45%,rgba(0,0,0,.55))] p-1 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 ${TOUCH_SHOW}`}
    >
      <ResizeIcon />
    </div>
  );

  const cornerButton =
    `flex h-6 w-6 cursor-pointer items-center justify-center rounded-[7px] border border-white/10 bg-[rgba(6,8,11,.65)] text-muted opacity-0 transition-opacity group-hover:opacity-100 ${TOUCH_SHOW}`;

  // ---------- saved notes ----------

  if (media.type === "markdown") {
    return (
      <div
        className={`flex items-stretch justify-center px-4 pb-1 pt-[6px] sm:px-[26px] ${
          height === null ? `min-h-[84px] ${FILL}` : "flex-none"
        }`}
      >
        <div
          ref={boxRef}
          style={height !== null ? { height } : undefined}
          className={`group relative h-full w-full overflow-y-auto rounded-[12px] border border-white/8 bg-panel px-3.5 py-3 ${CAP}`}
        >
          <div data-testid="track-markdown">
            <MarkdownView text={media.text} />
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              onClick={() => setEditId(seg.id)}
              title="Edit notes"
              data-testid="edit-notes"
              className={`${cornerButton} hover:text-ink`}
            >
              <PencilIcon size={11} />
            </button>
            <button
              onClick={remove}
              title="Remove notes"
              className={`${cornerButton} hover:text-danger`}
            >
              <CloseIcon size={11} strokeWidth={1.8} />
            </button>
          </div>
          {grip}
        </div>
      </div>
    );
  }

  // ---------- saved image ----------

  return (
    <div
      className={`flex items-center justify-center px-4 pb-1 pt-[6px] sm:px-[26px] ${
        height === null ? `min-h-[84px] ${FILL}` : "flex-none"
      }`}
    >
      <div
        ref={boxRef}
        style={height !== null ? { height } : undefined}
        className={`group relative h-full max-w-full overflow-hidden rounded-[12px] border border-white/8 bg-black shadow-[0_8px_30px_rgba(0,0,0,.4)] ${CAP}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.src}
          alt=""
          data-testid="track-image"
          className={`block h-full w-auto max-w-full object-contain max-sm:h-auto ${CAP}`}
        />
        <button
          onClick={remove}
          title="Remove image"
          className={`absolute right-2 top-2 ${cornerButton} hover:text-danger`}
        >
          <CloseIcon size={11} strokeWidth={1.8} />
        </button>
        {grip}
      </div>
    </div>
  );
}
