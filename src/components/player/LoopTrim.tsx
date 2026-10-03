"use client";

import { useEffect, useRef, useState } from "react";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { MIN_GAP, canSetLoopA, canSetLoopB, setLoopA, setLoopB } from "@/lib/loopEdit";
import { player } from "@/lib/player/controller";
import { fmt, parseTime } from "@/lib/time";
import { activeLoop, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";
import {
  redoLoopEdit,
  undoLoopEdit,
  useCanRedoLoop,
  useCanUndoLoop,
} from "@/store/loopHistory";

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
  const clampA = (v: number) => Math.max(0, Math.min(v, lp.b - MIN_GAP));
  const clampB = (v: number) => Math.max(lp.a + MIN_GAP, Math.min(v, track.duration));

  /** Typing one end into a time field re-spans the loop to this length around it. */
  const TYPED_SPAN = 10;

  /** Both ends move together, so each is clamped to the track rather than the other. */
  const spanFromA = (v: number) => {
    const a = Math.max(0, Math.min(v, track.duration - MIN_GAP));
    return { a, b: Math.min(a + TYPED_SPAN, track.duration) };
  };
  const spanFromB = (v: number) => {
    const b = Math.max(MIN_GAP, Math.min(v, track.duration));
    return { a: Math.max(b - TYPED_SPAN, 0), b };
  };

  // sync fields whenever the loop changes, unless the user is typing in them
  useEffect(() => {
    if (aRef.current && document.activeElement !== aRef.current) aRef.current.value = fmt(lp.a);
    if (bRef.current && document.activeElement !== bRef.current) bRef.current.value = fmt(lp.b);
  }, [lp.a, lp.b, track.id, track.activeLoopId]);

  const commit = (which: "a" | "b") => {
    const ref = which === "a" ? aRef : bRef;
    const v = parseTime(ref.current?.value);
    const cur = which === "a" ? lp.a : lp.b;
    // a blur with the value untouched must not re-span the loop
    if (v != null && v !== cur) patchActiveLoop(which === "a" ? spanFromA(v) : spanFromB(v));
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
    <div className="flex px-4 pt-3 sm:px-[26px]">
      <div className="flex flex-wrap items-center gap-x-[14px] gap-y-2 rounded-[11px] border border-white/8 bg-panel-2 px-[15px] py-[9px]">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9.5px] font-semibold tracking-[.1em] text-accent">LOOP START</span>
          <div className="flex items-center gap-[6px]">
            <NudgeButton onClick={() => patchActiveLoop({ a: clampA(lp.a - 0.01) })} title="−10ms">
              −
            </NudgeButton>
            <input
              ref={aRef}
              data-testid="loop-a"
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
        <div className="w-px self-stretch bg-white/8 max-sm:hidden" />
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9.5px] font-semibold tracking-[.1em] text-accent">LOOP END</span>
          <div className="flex items-center gap-[6px]">
            <NudgeButton onClick={() => patchActiveLoop({ b: clampB(lp.b - 0.01) })} title="−10ms">
              −
            </NudgeButton>
            <input
              ref={bRef}
              data-testid="loop-b"
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
        <div className="w-px self-stretch bg-white/8 max-sm:hidden" />
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9.5px] font-semibold tracking-[.1em] text-muted-3">LENGTH</span>
          <span data-testid="loop-len" className="tno text-[16px] font-semibold text-ink">{fmt(lp.b - lp.a)}</span>
        </div>
      </div>

    </div>
  );
}

/** "Set A/B here" at the playhead, plus loop-edit undo/redo. */
export function LoopSetButtons({ track }: { track: Track }) {
  const canUndo = useCanUndoLoop();
  const canRedo = useCanRedoLoop();
  const lp = activeLoop(track);

  // the playhead moves imperatively, so watch it here and only re-render when
  // a "Set A/B here" button flips between usable and refused
  const [canA, setCanA] = useState(true);
  const [canB, setCanB] = useState(true);
  useEffect(() => {
    let lastA: boolean | null = null;
    let lastB: boolean | null = null;
    const update = (t: number) => {
      const a = canSetLoopA(t);
      const b = canSetLoopB(t);
      if (a !== lastA) {
        lastA = a;
        setCanA(a);
      }
      if (b !== lastB) {
        lastB = b;
        setCanB(b);
      }
    };
    update(player.getT());
    return player.onTime(update);
  }, [lp.a, lp.b, track.id, track.activeLoopId]);

  const setBtnCls =
    "h-full cursor-pointer whitespace-nowrap rounded-[11px] border border-[rgba(94,234,212,.3)] bg-[rgba(94,234,212,.07)] px-[15px] py-[10px] text-[12.5px] font-semibold text-accent disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-muted-3";

  const histBtnCls =
    "flex h-full w-[42px] cursor-pointer items-center justify-center rounded-[11px] border border-white/10 bg-white/5 text-ink-3 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/3 disabled:text-muted-3 disabled:hover:border-white/8 disabled:hover:text-muted-3";

  return (
    <div className="box-content flex h-[42px] items-stretch gap-2 px-4 pt-3 sm:px-[26px]">
      <button
        onClick={() => setLoopA(player.getT())}
        disabled={!canA}
        title={canA ? undefined : "Playhead is past the loop end"}
        className={setBtnCls}
      >
        Set A here
      </button>
      <button
        onClick={() => setLoopB(player.getT())}
        disabled={!canB}
        title={canB ? undefined : "Playhead is before the loop start"}
        className={setBtnCls}
      >
        Set B here
      </button>
      <button
        onClick={undoLoopEdit}
        disabled={!canUndo}
        data-testid="loop-undo"
        title="Undo loop edit (Ctrl+Z)"
        aria-label="Undo loop edit"
        className={histBtnCls}
      >
        <UndoIcon />
      </button>
      <button
        onClick={redoLoopEdit}
        disabled={!canRedo}
        data-testid="loop-redo"
        title="Redo loop edit (Ctrl+Shift+Z)"
        aria-label="Redo loop edit"
        className={histBtnCls}
      >
        <RedoIcon />
      </button>
    </div>
  );
}
