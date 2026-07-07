"use client";

import { CloseIcon, NoteIcon, SearchIcon } from "@/components/icons";
import { player } from "@/lib/player/controller";
import { fmtS } from "@/lib/time";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

export function Sidebar() {
  const tracks = useLibrary((s) => s.tracks);
  const currentId = useLibrary((s) => s.currentId);
  const search = useLibrary((s) => s.search);
  const setSearch = useLibrary((s) => s.setSearch);
  const removeTrack = useLibrary((s) => s.removeTrack);
  const narrow = useUi((s) => s.narrow);
  const sidebarOpen = useUi((s) => s.sidebarOpen);

  if (!sidebarOpen) return null;

  const q = search.trim().toLowerCase();
  const filtered = tracks.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.artist || "").toLowerCase().includes(q) ||
      t.tags.some((x) => x.toLowerCase().includes(q)),
  );

  return (
    <aside
      className="flex min-h-0 flex-none flex-col border-r border-white/7 bg-panel"
      style={{ width: narrow ? 260 : 300 }}
    >
      <div className="flex-none px-[14px] pb-[10px] pt-[14px]">
        <div className="mb-[11px] flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[.13em] text-muted-3">LIBRARY</span>
          <span className="tno text-[11px] text-muted-5">{tracks.length}</span>
        </div>
        <div className="flex h-[34px] items-center gap-2 rounded-[8px] border border-white/8 bg-field px-[10px]">
          <SearchIcon className="flex-none text-muted-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loops & tags"
            className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-ink"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-[14px] pt-[2px]">
        {filtered.map((t) => {
          const active = t.id === currentId;
          return (
            <div
              key={t.id}
              onClick={() => player.selectTrack(t.id)}
              className="relative mb-[3px] flex cursor-pointer gap-[11px] rounded-[10px] border p-[10px]"
              style={{
                background: active ? "rgba(94,234,212,.08)" : "transparent",
                borderColor: active ? "rgba(94,234,212,.28)" : "transparent",
              }}
            >
              <div
                className="absolute bottom-[9px] left-0 top-[9px] w-[3px] rounded-[3px]"
                style={{ background: active ? t.accent : "transparent" }}
              />
              <div className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[7px] bg-field-2">
                {t.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex" style={{ color: t.accent }}>
                    <NoteIcon />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
                <span
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold"
                  style={{ color: active ? "#ffffff" : "#d5dae2" }}
                >
                  {t.title}
                </span>
                <div className="flex items-center gap-[7px] text-[11px] text-muted-3">
                  <span className="tno">{fmtS(t.duration || 0)}</span>
                  <span className="h-[3px] w-[3px] rounded-full bg-[#3a4150]" />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t.artist}</span>
                </div>
                {t.tags.length > 0 && (
                  <div className="mt-[1px] flex flex-wrap gap-[5px]">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[5px] border border-white/6 bg-white/5 px-[6px] py-[1px] text-[9.5px] tracking-[.03em] text-muted-2"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {tracks.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const wasCurrent = t.id === currentId;
                    removeTrack(t.id);
                    if (wasCurrent) player.afterRemoval();
                  }}
                  title="Remove"
                  className="flex h-[22px] w-[22px] flex-none cursor-pointer items-center justify-center self-start rounded-[6px] border-none bg-transparent text-muted-5 hover:bg-[rgba(248,113,113,.1)] hover:text-danger"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
