"use client";

import { useEffect } from "react";
import { TrashIcon } from "@/components/icons";
import { clearSegmentMedia, removeSegment } from "@/lib/extraMediaEdit";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

/**
 * Guards both destructive extra-media actions: the × on the panel, which
 * takes a segment's media away, and Delete in the times menu, which takes the
 * whole segment. An image is a re-upload and notes are typed by hand, so
 * neither is cheap to get back and neither is undoable.
 */
export function ConfirmRemoveExtraMediaModal() {
  const target = useUi((s) => s.confirmExtraMedia);
  const close = useUi((s) => s.closeExtraMediaConfirm);
  // the segment can disappear under the dialog (sync, another device) - read it
  // every render so a stale id closes instead of deleting something else
  const segs = useLibrary(
    (s) => s.tracks.find((t) => t.id === target?.trackId)?.extraMedia ?? null,
  );
  const seg = segs?.find((x) => x.id === target?.segId) ?? null;
  // clearing media is only offered where there is media to clear
  const gone = !seg || (target?.mode === "media" && !seg.media);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, close]);

  useEffect(() => {
    if (target && gone) close();
  }, [target, gone, close]);

  if (!target || !seg || gone) return null;

  const segment = target.mode === "segment";
  const last = segs?.length === 1;
  const notes = seg.media?.type === "markdown";

  const confirm = () => {
    if (segment) removeSegment(target.trackId, target.segId);
    else clearSegmentMedia(target.trackId, target.segId);
    close();
  };

  const title = segment
    ? "Delete this segment?"
    : notes
      ? "Remove these notes?"
      : "Remove this image?";

  const body = segment
    ? last
      ? "This is the only segment, so the track will be left with no extra media at all. This can't be undone."
      : "Its stretch of the track goes back to the neighbouring segment, taking its media with it. This can't be undone."
    : `${notes ? "The markdown text" : "The image"} will be deleted${
        last ? "" : " and its stretch of the track goes back to the neighbouring segment"
      }. This can't be undone.`;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-70 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-remove-extra-media"
        className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised p-[26px] shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[14px] flex h-11 w-11 items-center justify-center rounded-[12px] border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.1)] text-danger">
          <TrashIcon />
        </div>
        <h2 className="mb-2 mt-0 text-[18px] font-bold">{title}</h2>
        <p className="mb-5 mt-0 text-[13.5px] leading-[1.55] text-muted">{body}</p>
        <div className="flex gap-[10px]">
          <button
            autoFocus
            onClick={close}
            data-testid="confirm-remove-extra-media-cancel"
            className="h-11 flex-1 cursor-pointer rounded-[9px] border border-white/10 bg-field text-[13.5px] font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            data-testid="confirm-remove-extra-media-ok"
            className="h-11 flex-1 cursor-pointer rounded-[9px] border-none bg-danger text-[13.5px] font-semibold text-[#2b0b0b]"
          >
            {segment ? "Delete" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
