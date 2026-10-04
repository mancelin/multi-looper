"use client";

import { useEffect } from "react";
import { TrashIcon } from "@/components/icons";
import { fmtS } from "@/lib/time";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

export function ConfirmRemoveLoopModal() {
  const target = useUi((s) => s.confirmRemoveLoop);
  const close = useUi((s) => s.closeRemoveLoopConfirm);
  // removeLoop acts on the current track and never drops the last loop, so the
  // dialog only stands while its loop is still removable from the current track
  const loop = useLibrary((s) => {
    if (!target || s.currentId !== target.trackId) return null;
    const t = s.tracks.find((t) => t.id === target.trackId);
    if (!t || t.loops.length <= 1) return null;
    return t.loops.find((l) => l.id === target.loopId) ?? null;
  });

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
    if (target && !loop) close();
  }, [target, loop, close]);

  if (!target || !loop) return null;

  const confirm = () => {
    useLibrary.getState().removeLoop(loop.id);
    close();
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-70 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-remove-loop"
        className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised p-[26px] shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[14px] flex h-11 w-11 items-center justify-center rounded-[12px] border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.1)] text-danger">
          <TrashIcon />
        </div>
        <h2 className="mb-2 mt-0 text-[18px] font-bold">Remove this loop?</h2>
        <p className="mb-5 mt-0 text-[13.5px] leading-[1.55] text-muted">
          <strong className="text-ink">{loop.name || "Untitled loop"}</strong>{" "}
          <span className="tno">
            ({fmtS(loop.a)} – {fmtS(loop.b)})
          </span>{" "}
          will be deleted. This can&apos;t be undone.
        </p>
        <div className="flex gap-[10px]">
          <button
            autoFocus
            onClick={close}
            data-testid="confirm-remove-loop-cancel"
            className="h-11 flex-1 cursor-pointer rounded-[9px] border border-white/10 bg-field text-[13.5px] font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            data-testid="confirm-remove-loop-ok"
            className="h-11 flex-1 cursor-pointer rounded-[9px] border-none bg-danger text-[13.5px] font-semibold text-[#2b0b0b]"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
