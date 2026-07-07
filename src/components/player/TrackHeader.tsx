"use client";

import { useState } from "react";
import { CloseIcon, NoteIcon } from "@/components/icons";
import type { Track } from "@/lib/types";
import { useLibrary } from "@/store/library";

const SRC_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  youtube: {
    label: "YOUTUBE",
    color: "#fca5a5",
    bg: "rgba(248,113,113,.1)",
    border: "rgba(248,113,113,.3)",
  },
  fileAudio: {
    label: "LOCAL FILE",
    color: "#93c5fd",
    bg: "rgba(147,197,253,.1)",
    border: "rgba(147,197,253,.3)",
  },
  fileVideo: {
    label: "LOCAL VIDEO",
    color: "#c4b5fd",
    bg: "rgba(196,181,253,.1)",
    border: "rgba(196,181,253,.3)",
  },
};

export function TrackHeader({ track }: { track: Track }) {
  const addTag = useLibrary((s) => s.addTag);
  const removeTag = useLibrary((s) => s.removeTag);
  const [newTag, setNewTag] = useState("");

  const badge =
    track.kind === "youtube"
      ? SRC_BADGES.youtube
      : track.hasVideo
        ? SRC_BADGES.fileVideo
        : SRC_BADGES.fileAudio;

  const commitTag = () => {
    if (newTag.trim()) addTag(newTag);
    setNewTag("");
  };

  return (
    <div className="flex flex-none items-center gap-4 px-4 pb-[14px] pt-5 sm:px-[26px]">
      <div className="relative h-[66px] w-[66px] flex-none overflow-hidden rounded-[11px] border border-white/8 bg-field-2">
        {track.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ color: track.accent }}>
            <NoteIcon size={28} strokeWidth={1.6} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-[9px]">
          <span
            className="rounded-[5px] border px-[7px] py-[2px] text-[10px] font-semibold tracking-[.1em]"
            style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
          >
            {badge.label}
          </span>
          <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[21px] font-semibold">
            {track.title}
          </h1>
        </div>
        <div className="text-[13px] text-muted">{track.artist}</div>
        <div className="mt-[9px] flex flex-wrap items-center gap-[6px]">
          {track.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-[5px] rounded-[6px] border border-white/9 bg-white/5 py-[3px] pl-[9px] pr-1 text-[11px] text-ink-3"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                title="Remove tag"
                className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent p-0 text-muted-3 hover:bg-[rgba(248,113,113,.12)] hover:text-danger"
              >
                <CloseIcon size={9} strokeWidth={1.8} />
              </button>
            </span>
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitTag();
              } else if (e.key === "Backspace" && !newTag && track.tags.length) {
                removeTag(track.tags[track.tags.length - 1]);
              }
            }}
            onBlur={commitTag}
            placeholder="+ tag"
            className="w-[66px] rounded-[6px] border border-white/9 bg-field-2 px-2 py-1 text-[11px] text-ink focus:w-24 focus:border-accent"
          />
        </div>
      </div>
    </div>
  );
}
