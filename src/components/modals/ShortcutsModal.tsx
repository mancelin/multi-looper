"use client";

import { useUi } from "@/store/ui";

const SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: "Space", label: "Play / pause" },
  { key: "L", label: "Toggle loop" },
  { key: "A", label: "Set loop start at playhead" },
  { key: "B", label: "Set loop end at playhead" },
  { key: "Q / W", label: "Trim start −10 / +10 ms" },
  { key: "O / P", label: "Trim end −10 / +10 ms" },
  { key: "← / →", label: "Seek −5 / +5 s" },
  { key: "↑ / ↓", label: "Speed +5% / −5%" },
  { key: "< / >", label: "Previous / next song" },
  { key: "[ / ]", label: "Previous / next loop" },
  { key: "N", label: "Add loop at playhead" },
  { key: "1×", label: "Reset speed" },
];

export function ShortcutsModal() {
  const open = useUi((s) => s.showShortcuts);
  const toggle = useUi((s) => s.toggleShortcuts);
  if (!open) return null;

  return (
    <div
      onClick={toggle}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(560px,100%)] rounded-[16px] border border-white/10 bg-raised px-[26px] py-6 shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[18px] flex items-center justify-between">
          <h2 className="m-0 text-[17px] font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={toggle}
            className="h-[30px] w-[30px] cursor-pointer rounded-[8px] border border-white/10 bg-field-2 text-muted"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-[26px] gap-y-[9px]">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-3 border-b border-white/5 py-[6px]"
            >
              <span className="text-[13px] text-ink-3">{s.label}</span>
              <span className="tno whitespace-nowrap rounded-[6px] border border-white/12 border-b-2 bg-bg px-2 py-[3px] text-[11px] font-semibold text-ink">
                {s.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
