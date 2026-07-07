"use client";

import { useEffect, useRef } from "react";
import { setLoopA, setLoopB } from "@/lib/loopEdit";
import { player } from "@/lib/player/controller";
import { fmt, parseTime } from "@/lib/time";
import { activeLoop, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";

function NudgeButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[6px] border border-white/10 bg-field-2 text-[13px] leading-none text-muted"
    >
      {children}
    </button>
  );
}

export function LoopTrim({ track }: { track: Track }) {
  const patchActiveLoop = useLibrary((s) => s.patchActiveLoop);
  const aRef = useRef<HTMLInputElement>(null);
  const bRef = useRef<HTMLInputElement>(null);

  const lp = activeLoop(track);
  const clampA = (v: number) => Math.max(0, Math.min(v, lp.b - 0.05));
  const clampB = (v: number) => Math.max(lp.a + 0.05, Math.min(v, track.duration));

  // sync fields whenever the loop changes, unless the user is typing in them
  useEffect(() => {
    if (aRef.current && document.activeElement !== aRef.current) aRef.current.value = fmt(lp.a);
    if (bRef.current && document.activeElement !== bRef.current) bRef.current.value = fmt(lp.b);
  }, [lp.a, lp.b, track.id, track.activeLoopId]);

  const commit = (which: "a" | "b") => {
    const ref = which === "a" ? aRef : bRef;
    const v = parseTime(ref.current?.value);
    if (v != null) patchActiveLoop(which === "a" ? { a: clampA(v) } : { b: clampB(v) });
    setTimeout(() => {
      if (aRef.current && document.activeElement !== aRef.current) aRef.current.value = fmt(activeLoop(currentFromStore() ?? track).a);
      if (bRef.current && document.activeElement !== bRef.current) bRef.current.value = fmt(activeLoop(currentFromStore() ?? track).b);
    }, 0);
  };

  const currentFromStore = () => {
    const s = useLibrary.getState();
    return s.tracks.find((t) => t.id === s.currentId);
  };

  const handleKey = (which: "a" | "b", e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(which);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.currentTarget.value = fmt(which === "a" ? lp.a : lp.b);
      e.currentTarget.blur();
    }
  };

  const fieldCls =
    "tno w-[82px] rounded-[7px] border border-white/9 bg-field-2 px-0 py-[3px] text-center text-[16px] font-semibold text-ink focus:border-accent";

  return (
    <div className="flex flex-wrap items-stretch gap-[10px] px-[26px] pt-3">
      <div className="flex items-center gap-[14px] rounded-[11px] border border-white/8 bg-panel-2 px-[15px] py-[9px]">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9.5px] font-semibold tracking-[.1em] text-accent">LOOP START</span>
          <div className="flex items-center gap-[6px]">
            <NudgeButton onClick={() => patchActiveLoop({ a: clampA(lp.a - 0.01) })} title="−10ms">
              −
            </NudgeButton>
            <input
              ref={aRef}
              defaultValue={fmt(lp.a)}
              onFocus={(e) => e.target.select()}
              onBlur={() => commit("a")}
              onKeyDown={(e) => handleKey("a", e)}
              className={fieldCls}
            />
            <NudgeButton onClick={() => patchActiveLoop({ a: clampA(lp.a + 0.01) })} title="+10ms">
              +
            </NudgeButton>
          </div>
        </div>
        <div className="w-px self-stretch bg-white/8" />
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9.5px] font-semibold tracking-[.1em] text-accent">LOOP END</span>
          <div className="flex items-center gap-[6px]">
            <NudgeButton onClick={() => patchActiveLoop({ b: clampB(lp.b - 0.01) })} title="−10ms">
              −
            </NudgeButton>
            <input
              ref={bRef}
              defaultValue={fmt(lp.b)}
              onFocus={(e) => e.target.select()}
              onBlur={() => commit("b")}
              onKeyDown={(e) => handleKey("b", e)}
              className={fieldCls}
            />
            <NudgeButton onClick={() => patchActiveLoop({ b: clampB(lp.b + 0.01) })} title="+10ms">
              +
            </NudgeButton>
          </div>
        </div>
        <div className="w-px self-stretch bg-white/8" />
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9.5px] font-semibold tracking-[.1em] text-muted-3">LENGTH</span>
          <span className="tno text-[16px] font-semibold text-ink">{fmt(lp.b - lp.a)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setLoopA(player.getT())}
          className="h-full cursor-pointer whitespace-nowrap rounded-[11px] border border-[rgba(94,234,212,.3)] bg-[rgba(94,234,212,.07)] px-[15px] text-[12.5px] font-semibold text-accent"
        >
          Set A here
        </button>
        <button
          onClick={() => setLoopB(player.getT())}
          className="h-full cursor-pointer whitespace-nowrap rounded-[11px] border border-[rgba(94,234,212,.3)] bg-[rgba(94,234,212,.07)] px-[15px] text-[12.5px] font-semibold text-accent"
        >
          Set B here
        </button>
      </div>
    </div>
  );
}
