"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LoopIcon, MicIcon, PlusIcon, UploadIcon, YoutubeIcon } from "@/components/icons";
import { addFiles, addYoutubeUrl } from "@/store/ingest";
import { useUi } from "@/store/ui";

export function EmptyState() {
  const setRecordOpen = useUi((s) => s.setRecordOpen);
  const [ytUrl, setYtUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submitYt = () => {
    if (!ytUrl.trim()) return;
    addYoutubeUrl(ytUrl);
    setYtUrl("");
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_-10%,#12161d_0%,#0c0e12_60%)] px-6 py-10">
      <div className="m-auto flex w-full max-w-[900px] flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-end justify-center gap-[7px] rounded-[24px] border border-[rgba(94,234,212,.22)] bg-[linear-gradient(135deg,#12303080,#0e1116)] py-[26px] shadow-[0_12px_44px_rgba(45,212,191,.16)]">
          <span className="h-[22px] w-[7px] rounded-[4px] bg-accent [animation:eq_1.1s_ease-in-out_-0.2s_infinite]" />
          <span className="h-10 w-[7px] rounded-[4px] bg-accent-2 [animation:eq_1.1s_ease-in-out_-0.5s_infinite]" />
          <span className="h-[30px] w-[7px] rounded-[4px] bg-accent [animation:eq_1.1s_ease-in-out_-0.8s_infinite]" />
          <span className="h-4 w-[7px] rounded-[4px] bg-accent-3 [animation:eq_1.1s_ease-in-out_-0.1s_infinite]" />
        </div>

        <h1 className="mb-0 mt-[26px] flex items-center gap-3 text-[30px] font-bold tracking-[-.01em] text-white">
          Loop anything
          <LoopIcon size={26} aria-hidden className="text-accent" />
        </h1>
        <p className="mb-0 mt-3 max-w-[460px] text-[15px] leading-[1.6] text-muted">
          Drop in a track, mark an A–B section, and practice it on repeat, slowed
          down, pitch intact. Start with a YouTube link, your own audio, or a take straight from your mic.
        </p>

        <div className="mt-[34px] flex w-full flex-wrap justify-center gap-4">
          <div className="flex min-w-[270px] max-w-[340px] flex-1 flex-col items-start rounded-[16px] border border-white/8 bg-panel-2 px-5 py-[22px] text-left">
            <div className="mb-[14px] flex items-center gap-[10px]">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.1)] text-[#e11d48]">
                <YoutubeIcon size={20} hole="#0f1319" />
              </span>
              <span className="text-[15px] font-semibold text-ink">Paste a link</span>
            </div>
            <p className="mb-[14px] mt-0 text-[12.5px] leading-[1.5] text-muted-3">
              Any YouTube video: backing tracks, solos, lessons.
            </p>
            <div className="flex h-10 w-full items-center gap-2 rounded-[9px] border border-white/9 bg-field px-[11px]">
              <input
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitYt()}
                placeholder="youtube.com/watch?v=…"
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink"
              />
              <button
                onClick={submitYt}
                className="flex-none cursor-pointer rounded-[6px] bg-accent px-3 py-[7px] text-[12px] font-semibold text-on-accent"
              >
                Add
              </button>
            </div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="flex min-w-[270px] max-w-[340px] flex-1 cursor-pointer flex-col items-start rounded-[16px] border border-dashed border-[rgba(94,234,212,.35)] bg-panel-2 px-5 py-[22px] text-left hover:border-[rgba(94,234,212,.6)] hover:bg-[#111722]"
          >
            <div className="mb-[14px] flex items-center gap-[10px]">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[rgba(147,197,253,.25)] bg-[rgba(147,197,253,.1)] text-src-audio">
                <UploadIcon size={19} />
              </span>
              <span className="text-[15px] font-semibold text-ink">Upload audio</span>
            </div>
            <p className="mb-[14px] mt-0 text-[12.5px] leading-[1.5] text-muted-3">
              MP3, WAV, or any audio file from your device.
            </p>
            <div className="flex h-10 w-full items-center justify-center gap-2 rounded-[9px] border border-[rgba(94,234,212,.25)] bg-[rgba(94,234,212,.06)] text-[13px] font-semibold text-accent">
              <PlusIcon size={15} />
              Choose files
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*"
              multiple
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                void addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </div>

          <div
            onClick={() => setRecordOpen(true)}
            data-testid="empty-record"
            className="flex min-w-[270px] max-w-[340px] flex-1 cursor-pointer flex-col items-start rounded-[16px] border border-white/8 bg-panel-2 px-5 py-[22px] text-left hover:border-[rgba(253,186,116,.5)] hover:bg-[#111722]"
          >
            <div className="mb-[14px] flex items-center gap-[10px]">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[rgba(253,186,116,.25)] bg-[rgba(253,186,116,.1)] text-[#fdba74]">
                <MicIcon size={19} />
              </span>
              <span className="text-[15px] font-semibold text-ink">Record audio</span>
            </div>
            <p className="mb-[14px] mt-0 text-[12.5px] leading-[1.5] text-muted-3">
              Play into your mic and loop the take right away.
            </p>
            <div className="flex h-10 w-full items-center justify-center gap-2 rounded-[9px] border border-[rgba(253,186,116,.25)] bg-[rgba(253,186,116,.06)] text-[13px] font-semibold text-[#fdba74]">
              <MicIcon size={15} />
              Start recording
            </div>
          </div>
        </div>

        <nav aria-label="Legal" className="mt-[34px] flex gap-5 text-[12px]">
          <Link href="/privacy" className="opacity-70 hover:opacity-100">
            Privacy policy
          </Link>
          <Link href="/terms" className="opacity-70 hover:opacity-100">
            Terms of service
          </Link>
        </nav>
      </div>
    </div>
  );
}
