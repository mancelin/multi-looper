"use client";

import { useEffect, useRef } from "react";
import { ClockIcon, LoopIcon, PauseIcon, PlayIcon, VolumeIcon } from "@/components/icons";
import { player } from "@/lib/player/controller";
import { fmt, fmtS, parseTime } from "@/lib/time";
import type { Track } from "@/lib/types";
import { useUi } from "@/store/ui";

export function Transport({ track }: { track: Track }) {
  const playing = useUi((s) => s.playing);
  const loopEnabled = useUi((s) => s.loopEnabled);
  const toggleLoop = useUi((s) => s.toggleLoop);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      player.onTime((t) => {
        if (timeRef.current) timeRef.current.textContent = fmt(t);
      }),
    [],
  );
  useEffect(() => {
    if (timeRef.current) timeRef.current.textContent = fmt(player.getT());
  }, [track.id]);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pt-[14px] sm:gap-[18px] sm:px-[26px]">
      <button
        onClick={() => player.togglePlay()}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-[54px] w-[54px] cursor-pointer items-center justify-center rounded-[14px] border-none bg-gradient-to-br from-accent-2 to-accent-3 text-on-accent-2 shadow-[0_4px_18px_rgba(45,212,191,.4)]"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="flex min-w-[150px] items-baseline gap-2">
        <span ref={timeRef} data-testid="time" className="tno text-[19px] font-semibold text-ink">
          0:00.000
        </span>
        <span className="tno text-[13px] text-muted-4">/ {fmtS(track.duration || 0)}</span>
      </div>

      <div className="flex items-center gap-[9px]">
        <button
          onClick={toggleLoop}
          aria-pressed={loopEnabled}
          className="flex h-10 cursor-pointer items-center gap-[7px] rounded-[10px] border px-[14px] text-[13px] font-semibold"
          style={{
            borderColor: loopEnabled ? "#5eead4" : "rgba(255,255,255,.1)",
            background: loopEnabled ? "#5eead4" : "#14171d",
            color: loopEnabled ? "#052e2b" : "#8a92a2",
          }}
        >
          <LoopIcon />
          Loop
        </button>
      </div>

    </div>
  );
}

/** Playback speed and volume, the last row of the player column. */
export function SpeedVolume() {
  const rate = useUi((s) => s.rate);
  const volume = useUi((s) => s.volume);
  const rateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rateRef.current && document.activeElement !== rateRef.current) {
      rateRef.current.value = rate.toFixed(2);
    }
  }, [rate]);

  const commitRate = () => {
    const v = parseTime(rateRef.current?.value);
    if (v != null) player.applyRate(v);
    setTimeout(() => {
      if (rateRef.current && document.activeElement !== rateRef.current) {
        rateRef.current.value = useUi.getState().rate.toFixed(2);
      }
    }, 0);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pb-[18px] pt-3 sm:gap-[18px] sm:px-[26px]">
      <div className="flex min-w-0 max-w-[380px] flex-1 basis-[240px] items-center gap-[10px] rounded-[11px] border border-white/8 bg-panel-2 px-[14px] py-2">
        <ClockIcon className="flex-none text-muted" />
        <span className="flex-none text-[9.5px] font-semibold tracking-[.1em] text-muted-3">SPEED</span>
        <input
          type="range"
          min={0.25}
          max={1.5}
          step={0.05}
          value={rate}
          onChange={(e) => player.applyRate(parseFloat(e.target.value))}
          className="h-1 min-w-0 flex-1 accent-accent"
        />
        <div className="flex flex-none items-baseline gap-[2px]">
          <input
            ref={rateRef}
            defaultValue={rate.toFixed(2)}
            onFocus={(e) => e.target.select()}
            onBlur={commitRate}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRate();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.currentTarget.value = useUi.getState().rate.toFixed(2);
                e.currentTarget.blur();
              }
            }}
            title="Type a speed from 0.25 to 1.50"
            className="tno w-12 rounded-[7px] border border-white/9 bg-field-2 px-0 py-1 text-center text-[15px] font-semibold text-ink focus:border-accent"
          />
          <span className="tno text-[13px] text-muted">×</span>
        </div>
        <button
          onClick={() => player.applyRate(1)}
          title="Reset to 1.00×"
          className="flex-none cursor-pointer border-none bg-transparent text-[11px] font-semibold text-accent"
        >
          1×
        </button>
      </div>

      <div className="flex min-w-0 max-w-[240px] flex-1 basis-[160px] items-center gap-[10px] rounded-[11px] border border-white/8 bg-panel-2 px-[14px] py-2">
        <button
          onClick={() => player.toggleMute()}
          aria-label={volume === 0 ? "Unmute" : "Mute"}
          title={volume === 0 ? "Unmute" : "Mute"}
          className="flex flex-none cursor-pointer items-center border-none bg-transparent p-0 text-muted hover:text-ink"
        >
          <VolumeIcon muted={volume === 0} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => player.applyVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          className="h-1 min-w-0 flex-1 accent-accent"
        />
        <span className="tno w-8 flex-none text-right text-[11px] font-semibold text-muted">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
