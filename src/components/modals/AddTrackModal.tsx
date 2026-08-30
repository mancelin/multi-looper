"use client";

import { useEffect, useRef } from "react";
import { MicIcon, UploadIcon, YoutubeIcon } from "@/components/icons";
import { addFiles } from "@/store/ingest";
import { useUi } from "@/store/ui";

interface RowProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  testId: string;
  onClick: () => void;
}

function Row({ icon, label, hint, testId, onClick }: RowProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex w-full cursor-pointer items-center gap-[13px] rounded-[12px] border border-white/9 bg-field px-[14px] py-[13px] text-left"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-white/10 bg-field-2 text-muted">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        <span className="block text-[12.5px] text-muted">{hint}</span>
      </span>
    </button>
  );
}

export function AddTrackModal() {
  const open = useUi((s) => s.addMenuOpen);
  const setOpen = useUi((s) => s.setAddMenuOpen);
  const setYtModalOpen = useUi((s) => s.setYtModalOpen);
  const setRecordOpen = useUi((s) => s.setRecordOpen);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="add-track-sheet"
        className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised px-[18px] py-[18px] shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[14px] flex items-center justify-between">
          <h2 className="m-0 text-[16px] font-semibold">Add a track</h2>
          <button
            onClick={() => setOpen(false)}
            title="Close"
            className="h-[30px] w-[30px] cursor-pointer rounded-[8px] border border-white/10 bg-field-2 text-muted"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-[10px]">
          <Row
            icon={<YoutubeIcon className="text-[#e11d48]" />}
            label="YouTube link"
            hint="Paste a video URL"
            testId="add-youtube"
            onClick={() => setYtModalOpen(true)}
          />
          <Row
            icon={<UploadIcon />}
            label="Local file"
            hint="Audio or video file"
            testId="add-file"
            onClick={() => fileRef.current?.click()}
          />
          <Row
            icon={<MicIcon />}
            label="Record"
            hint="Capture a take live"
            testId="add-record"
            onClick={() => setRecordOpen(true)}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (!files.length) return;
            void addFiles(files);
            setOpen(false);
          }}
        />
      </div>
    </div>
  );
}
