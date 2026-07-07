"use client";

import { useState } from "react";
import { YoutubeIcon } from "@/components/icons";
import { addYoutubeUrl } from "@/store/ingest";
import { useUi } from "@/store/ui";

export function YoutubeModal() {
  const open = useUi((s) => s.ytModalOpen);
  if (!open) return null;
  return <YoutubeModalContent />;
}

/** Mounted only while open, so url/error state starts fresh each time. */
function YoutubeModalContent() {
  const setOpen = useUi((s) => s.setYtModalOpen);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  const close = () => setOpen(false);
  const submit = () => {
    if (!url.trim()) return;
    if (addYoutubeUrl(url)) {
      close();
    } else {
      setError(true);
    }
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised px-[26px] py-6 shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.1)] text-[#e11d48]">
              <YoutubeIcon size={17} hole="#0f1319" />
            </span>
            <h2 className="m-0 text-[17px] font-semibold">Add a YouTube link</h2>
          </div>
          <button
            onClick={close}
            className="h-[30px] w-[30px] cursor-pointer rounded-[8px] border border-white/10 bg-field-2 text-muted"
          >
            ✕
          </button>
        </div>
        <div className="flex h-10 items-center gap-2 rounded-[9px] border border-white/9 bg-field px-[11px]">
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") close();
            }}
            placeholder="youtube.com/watch?v=…"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink"
          />
          <button
            onClick={submit}
            className="flex-none cursor-pointer rounded-[6px] bg-accent px-3 py-[7px] text-[12px] font-semibold text-on-accent"
          >
            Add
          </button>
        </div>
        {error && (
          <p className="mb-0 mt-[10px] text-[12.5px] text-danger">
            That doesn&apos;t look like a YouTube link.
          </p>
        )}
      </div>
    </div>
  );
}
