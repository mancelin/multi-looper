"use client";

import { useEffect } from "react";
import { TrashIcon } from "@/components/icons";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

/**
 * Guards the × on the extra-media panel: an image is a re-upload and notes are
 * typed by hand, so neither is cheap to get back and neither is undoable.
 */
export function ConfirmRemoveExtraMediaModal() {
  const id = useUi((s) => s.confirmExtraMediaId);
  const close = useUi((s) => s.closeExtraMediaConfirm);
  // the media can disappear under the dialog (sync, another device) — read it
  // every render so a stale id closes instead of deleting something else
  const media = useLibrary((s) => s.tracks.find((t) => t.id === id)?.extraMedia ?? null);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, close]);

  useEffect(() => {
    if (id && !media) close();
  }, [id, media, close]);

  if (!id || !media) return null;

  const notes = media.type === "markdown";

  const confirm = () => {
    useLibrary.getState().patchTrack(id, { extraMedia: undefined });
    close();
  };

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
        <h2 className="mb-2 mt-0 text-[18px] font-bold">
          {notes ? "Remove these notes?" : "Remove this cover image?"}
        </h2>
        <p className="mb-5 mt-0 text-[13.5px] leading-[1.55] text-muted">
          {notes
            ? "The markdown text will be deleted. This can't be undone."
            : "The image will be deleted from this track. This can't be undone."}
        </p>
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
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
