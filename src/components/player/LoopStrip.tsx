"use client";

import { CloseIcon, PlusIcon, ShareIcon } from "@/components/icons";
import { addLoopAtPlayhead, selectLoopAndSeek } from "@/lib/loopEdit";
import { buildShareUrl } from "@/lib/share";
import { fmtS } from "@/lib/time";
import { activeLoop, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

export function LoopStrip({ track }: { track: Track }) {
  const removeLoop = useLibrary((s) => s.removeLoop);
  const renameLoop = useLibrary((s) => s.renameLoop);
  const pushToast = useUi((s) => s.pushToast);

  const shareActiveLoop = async () => {
    const url = buildShareUrl(window.location.origin, track, activeLoop(track));
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      pushToast("Share link copied");
    } catch {
      pushToast("Copying the share link failed");
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 pt-[15px] sm:px-[26px]">
      <div className="hidden flex-none flex-col gap-[1px] min-[480px]:flex">
        <span className="text-[9.5px] font-semibold tracking-[.1em] text-muted-3">LOOPS</span>
        <span className="tno text-[10px] text-muted-5">
          {track.loops.length} {track.loops.length === 1 ? "loop" : "loops"}
        </span>
      </div>
      <div className="flex flex-1 flex-wrap gap-2 pb-1 pt-[2px]">
        {track.loops.map((l) => {
          const active = l.id === track.activeLoopId;
          return (
            <div
              key={l.id}
              onClick={() => selectLoopAndSeek(l.id)}
              className="flex h-10 flex-none cursor-pointer items-center gap-2 rounded-[10px] border pl-[11px] pr-[7px]"
              style={{
                background: active ? "rgba(94,234,212,.12)" : "#14171d",
                borderColor: active ? "rgba(94,234,212,.5)" : "rgba(255,255,255,.08)",
              }}
            >
              <span
                className="h-[7px] w-[7px] flex-none rounded-full"
                style={{ background: active ? track.accent : "#4b5563" }}
              />
              <div className="flex min-w-0 flex-col min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-2">
                <input
                  value={l.name}
                  readOnly={!active}
                  onChange={(e) => renameLoop(l.id, e.target.value)}
                  onClick={(e) => active && e.stopPropagation()}
                  title="Rename loop"
                  className={`w-[72px] min-w-0 border-none bg-transparent text-[12.5px] font-semibold min-[480px]:w-[92px] ${active ? "" : "pointer-events-none"}`}
                  style={{ color: active ? "#ffffff" : "#b8bfca" }}
                />
                <span className="tno flex-none text-[10.5px] leading-[13px] text-muted-2 min-[480px]:leading-normal">
                  {fmtS(l.a)} – {fmtS(l.b)}
                </span>
              </div>
              {track.loops.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLoop(l.id);
                  }}
                  title="Remove loop"
                  className="flex h-[22px] w-[22px] flex-none cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-muted-4 hover:bg-[rgba(248,113,113,.12)] hover:text-danger"
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={addLoopAtPlayhead}
          title="Add a loop at the playhead (N)"
          className="flex h-10 flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-dashed border-[rgba(94,234,212,.4)] bg-[rgba(94,234,212,.05)] px-[13px] text-[12.5px] font-semibold text-accent"
        >
          <PlusIcon />
          <span className="hidden min-[480px]:inline">Add loop</span>
        </button>
        {track.kind === "youtube" && (
          <button
            onClick={shareActiveLoop}
            title="Copy a share link for the active loop"
            className="flex h-10 flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-white/9 bg-white/5 px-[13px] text-[12.5px] font-semibold text-ink-3 hover:border-accent hover:text-accent"
          >
            <ShareIcon />
            <span className="hidden min-[480px]:inline">Share</span>
          </button>
        )}
      </div>
    </div>
  );
}
