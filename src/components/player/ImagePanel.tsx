"use client";

import { CloseIcon } from "@/components/icons";
import type { Track } from "@/lib/types";
import { useLibrary } from "@/store/library";

/** Cover image for file tracks, shown above the waveform. */
export function ImagePanel({ track }: { track: Track }) {
  const patchTrack = useLibrary((s) => s.patchTrack);
  if (track.kind !== "file" || !track.image) return null;

  return (
    <div className="flex flex-none items-center justify-center px-4 pb-1 pt-[6px] sm:px-[26px]">
      <div className="group relative max-w-full overflow-hidden rounded-[12px] border border-white/8 bg-black shadow-[0_8px_30px_rgba(0,0,0,.4)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.image}
          alt=""
          data-testid="track-image"
          className="block max-h-[38dvh] min-h-[72px] min-w-[72px] max-w-full object-contain"
        />
        <button
          onClick={() => patchTrack(track.id, { image: undefined })}
          title="Remove image"
          className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[7px] border border-white/10 bg-[rgba(6,8,11,.65)] text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          <CloseIcon size={11} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
