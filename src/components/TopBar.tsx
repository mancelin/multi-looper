"use client";

import { useRef, useState } from "react";
import { BookIcon, EqIcon, GearIcon, KeyboardIcon, UploadIcon, YoutubeIcon } from "@/components/icons";
import { addFiles, addYoutubeUrl } from "@/store/ingest";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";
import { AccountArea } from "./AccountMenu";

export function TopBar() {
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const hasTracks = useLibrary((s) => s.tracks.length > 0);
  const toggleShortcuts = useUi((s) => s.toggleShortcuts);
  const openSettings = useUi((s) => s.openSettings);
  const setYtModalOpen = useUi((s) => s.setYtModalOpen);
  const [ytUrl, setYtUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submitYt = () => {
    if (!ytUrl.trim()) return;
    addYoutubeUrl(ytUrl);
    setYtUrl("");
  };

  return (
    <header className="z-5 flex h-[58px] flex-none items-center gap-3 border-b border-white/7 bg-panel px-3 sm:gap-[18px] sm:px-[18px]">
      <div className="flex items-center gap-[11px]">
        {hasTracks && (
          <button
            onClick={toggleSidebar}
            className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[8px] border border-white/10 bg-field-2 text-muted"
            title="Toggle library"
          >
            <BookIcon />
          </button>
        )}
        <div className="flex items-center gap-[9px]">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-gradient-to-br from-accent-2 to-accent-3 shadow-[0_2px_10px_rgba(45,212,191,.35)]">
            <EqIcon />
          </div>
          <span className="whitespace-nowrap text-[12px] font-bold tracking-[.06em] min-[480px]:text-[14px] min-[480px]:tracking-[.14em]">
            multi-looper
          </span>
        </div>
      </div>

      <div className="flex min-w-0 max-w-[640px] flex-1 items-center gap-2 sm:gap-[10px]">
        <button
          onClick={() => setYtModalOpen(true)}
          title="Add a YouTube link"
          className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-white/9 bg-field min-[480px]:hidden"
        >
          <YoutubeIcon className="text-[#e11d48]" />
        </button>
        <div className="hidden h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-white/9 bg-field px-[11px] min-[480px]:flex">
          <YoutubeIcon className="flex-none text-[#e11d48]" />
          <input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitYt()}
            placeholder="Paste a YouTube link…"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink"
          />
          <button
            onClick={submitYt}
            className="flex-none cursor-pointer rounded-[6px] bg-accent px-[11px] py-[6px] text-[12px] font-semibold text-on-accent"
          >
            Add
          </button>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-[38px] flex-none cursor-pointer items-center gap-[7px] rounded-[9px] border border-white/9 bg-field px-[13px] text-[13px] font-medium text-ink"
          title="Upload file"
        >
          <UploadIcon />
          <span className="hidden sm:inline">Upload file</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <button
          onClick={toggleShortcuts}
          title="Keyboard shortcuts"
          className="hidden h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-white/9 bg-field text-muted sm:flex"
        >
          <KeyboardIcon />
        </button>
      </div>

      <div className="ml-auto flex flex-none items-center gap-2">
        <button
          onClick={openSettings}
          title="Settings"
          className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-white/9 bg-field text-muted"
        >
          <GearIcon />
        </button>
        <AccountArea />
      </div>
    </header>
  );
}
