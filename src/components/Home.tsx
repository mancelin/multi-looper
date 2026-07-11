"use client";

import { useEffect } from "react";
import { AuthModal } from "@/components/modals/AuthModal";
import { ImportModal } from "@/components/modals/ImportModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ShortcutsModal } from "@/components/modals/ShortcutsModal";
import { YoutubeModal } from "@/components/modals/YoutubeModal";
import { EmptyState } from "@/components/EmptyState";
import { PlayerMain } from "@/components/player/PlayerMain";
import { ShortcutsProvider } from "@/components/ShortcutsProvider";
import { Sidebar } from "@/components/Sidebar";
import { Toasts } from "@/components/Toasts";
import { TopBar } from "@/components/TopBar";
import { consumeShareLink } from "@/lib/share";
import { loadGuestLibrary, restoreFileMedia, startGuestPersistence } from "@/store/guestPersist";
import { useCurrentTrack, useLibrary } from "@/store/library";
import { bootAuth, consumeVerificationLink } from "@/store/sync";
import { useUi } from "@/store/ui";
import { applyTrackFromUrl, startUrlSync } from "@/store/urlSync";

let booted = false;

export function Home() {
  const hasTracks = useLibrary((s) => s.tracks.length > 0);
  const track = useCurrentTrack();
  const setNarrow = useUi((s) => s.setNarrow);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 820);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setNarrow]);

  useEffect(() => {
    if (booted) return;
    booted = true;
    startGuestPersistence();
    void consumeVerificationLink();
    void bootAuth().then(async (restored) => {
      if (!restored) {
        const guest = loadGuestLibrary();
        if (guest?.tracks.length) {
          await restoreFileMedia(guest.tracks);
          useLibrary.getState().setLibrary(guest.tracks, guest.currentId);
        }
      }
      consumeShareLink();
      applyTrackFromUrl();
      startUrlSync();
    });
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <TopBar />
      {hasTracks && track ? (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <PlayerMain track={track} />
        </div>
      ) : (
        <EmptyState />
      )}
      <ShortcutsProvider />
      <ShortcutsModal />
      <YoutubeModal />
      <AuthModal />
      <ImportModal />
      <SettingsModal />
      <Toasts />
    </div>
  );
}
