"use client";

import { useEffect } from "react";
import { TrashIcon } from "@/components/icons";
import { player } from "@/lib/player/controller";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

export function ConfirmRemoveModal() {
  const id = useUi((s) => s.confirmRemoveId);
  const close = useUi((s) => s.closeRemoveConfirm);
  // the row can disappear under the dialog (sync, another device) - read the
  // track every render so a stale id closes instead of removing the wrong one
  const track = useLibrary((s) => s.tracks.find((t) => t.id === id) ?? null);

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
    if (id && !track) close();
  }, [id, track, close]);

  if (!id || !track) return null;

  const confirm = () => {
    const wasCurrent = track.id === useLibrary.getState().currentId;
    useLibrary.getState().removeTrack(track.id);
    if (wasCurrent) player.afterRemoval();
    close();
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-70 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-remove"
        className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised p-[26px] shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[14px] flex h-11 w-11 items-center justify-center rounded-[12px] border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.1)] text-danger">
          <TrashIcon />
        </div>
        <h2 className="mb-2 mt-0 text-[18px] font-bold">Remove this track?</h2>
        <p className="mb-5 mt-0 text-[13.5px] leading-[1.55] text-muted">
          <strong className="text-ink">{track.title}</strong>{" "}
          and its loops will be deleted. This can&apos;t be undone.
        </p>
        <div className="flex gap-[10px]">
          <button
            autoFocus
            onClick={close}
            data-testid="confirm-remove-cancel"
            className="h-11 flex-1 cursor-pointer rounded-[9px] border border-white/10 bg-field text-[13.5px] font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            data-testid="confirm-remove-ok"
            className="h-11 flex-1 cursor-pointer rounded-[9px] border-none bg-danger text-[13.5px] font-semibold text-[#2b0b0b]"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
