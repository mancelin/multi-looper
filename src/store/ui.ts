"use client";

import { create } from "zustand";

export interface Account {
  id: string;
  email: string;
  /** bigger media quota; set from the PocketBase dashboard */
  premium: boolean;
}

export type AuthMode = "signup" | "signin";

export type SettingsView = "menu" | "password" | "info" | "privacy" | "terms";

export interface Toast {
  id: number;
  message: string;
}

export interface UiState {
  playing: boolean;
  /** true while the YouTube IFrame player actually plays/buffers — unlike
   *  `playing` (transport intent) this follows the player's real state, so
   *  the poster cover only lifts when YouTube truly renders video frames */
  ytSurfaceLive: boolean;
  rate: number;
  /** 0–1 media volume, applied to both backends by the player controller */
  volume: number;
  loopEnabled: boolean;
  narrow: boolean;
  sidebarOpen: boolean;
  videoWidth: number;
  showShortcuts: boolean;
  ytModalOpen: boolean;
  /** compact "+" sheet listing the add-a-track options (narrow screens) */
  addMenuOpen: boolean;
  recordOpen: boolean;
  /** run mic takes through the browser's speech denoiser */
  recordDenoise: boolean;
  /** track awaiting the remove confirmation, null when the dialog is closed */
  confirmRemoveId: string | null;
  /** extra-media removal awaiting confirmation: either just the segment's
   *  media ("media") or the whole segment and its stretch of track ("segment") */
  confirmExtraMedia: { trackId: string; segId: string; mode: "media" | "segment" } | null;
  /** the extra-media times menu is unfolded; folded by default so the strip
   *  costs one header row until someone actually wants to retime something */
  extraTimesOpen: boolean;

  account: Account | null;
  accountMenuOpen: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  authError: string;
  authBusy: boolean;
  importOpen: boolean;
  /** number of guest tracks pending the import decision */
  importCount: number;
  settingsOpen: boolean;
  settingsView: SettingsView;
  syncBusy: boolean;
  /** bytes of PB media storage in use; null until fetched */
  storageUsed: number | null;
  toasts: Toast[];

  setPlaying: (v: boolean) => void;
  setYtSurfaceLive: (v: boolean) => void;
  setRate: (v: number) => void;
  setVolume: (v: number) => void;
  toggleLoop: () => void;
  setNarrow: (v: boolean) => void;
  toggleSidebar: () => void;
  setVideoWidth: (w: number) => void;
  toggleShortcuts: () => void;
  setYtModalOpen: (v: boolean) => void;
  setAddMenuOpen: (v: boolean) => void;
  setRecordOpen: (v: boolean) => void;
  setRecordDenoise: (v: boolean) => void;
  askRemoveTrack: (id: string) => void;
  closeRemoveConfirm: () => void;
  askRemoveExtraMedia: (trackId: string, segId: string, mode?: "media" | "segment") => void;
  closeExtraMediaConfirm: () => void;
  toggleExtraTimes: () => void;

  setAccount: (a: Account | null) => void;
  setAccountMenuOpen: (v: boolean) => void;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  toggleAuthMode: () => void;
  setAuthError: (msg: string) => void;
  setAuthBusy: (v: boolean) => void;
  setImport: (open: boolean, count?: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
  setSettingsView: (v: SettingsView) => void;
  setSyncBusy: (v: boolean) => void;
  setStorageUsed: (v: number | null) => void;
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;
const TOAST_TTL = 6000;

export const useUi = create<UiState>()((set) => ({
  playing: false,
  ytSurfaceLive: false,
  rate: 1,
  volume: 1,
  loopEnabled: true,
  narrow: false,
  sidebarOpen: true,
  videoWidth: 620,
  showShortcuts: false,
  ytModalOpen: false,
  addMenuOpen: false,
  recordOpen: false,
  recordDenoise: true,
  confirmRemoveId: null,
  confirmExtraMedia: null,
  extraTimesOpen: false,

  account: null,
  accountMenuOpen: false,
  authOpen: false,
  authMode: "signup",
  authError: "",
  authBusy: false,
  importOpen: false,
  importCount: 0,
  settingsOpen: false,
  settingsView: "menu",
  syncBusy: false,
  storageUsed: null,
  toasts: [],

  setPlaying: (v) => set({ playing: v }),
  setYtSurfaceLive: (v) => set((s) => (s.ytSurfaceLive === v ? s : { ytSurfaceLive: v })),
  setRate: (v) => set({ rate: v }),
  setVolume: (v) => set({ volume: v }),
  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),
  // entering narrow closes the drawer, leaving it restores the docked sidebar
  setNarrow: (v) => set((s) => (s.narrow === v ? s : { narrow: v, sidebarOpen: !v })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setVideoWidth: (w) => set({ videoWidth: w }),
  toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
  setYtModalOpen: (v) => set({ ytModalOpen: v, addMenuOpen: false }),
  setAddMenuOpen: (v) => set({ addMenuOpen: v }),
  setRecordOpen: (v) => set({ recordOpen: v, addMenuOpen: false }),
  setRecordDenoise: (v) => set({ recordDenoise: v }),
  askRemoveTrack: (id) => set({ confirmRemoveId: id }),
  closeRemoveConfirm: () => set({ confirmRemoveId: null }),
  askRemoveExtraMedia: (trackId, segId, mode = "media") =>
    set({ confirmExtraMedia: { trackId, segId, mode } }),
  closeExtraMediaConfirm: () => set({ confirmExtraMedia: null }),
  toggleExtraTimes: () => set((s) => ({ extraTimesOpen: !s.extraTimesOpen })),

  setAccount: (a) => set(a ? { account: a } : { account: null, storageUsed: null }),
  setAccountMenuOpen: (v) => set({ accountMenuOpen: v }),
  openAuth: (mode = "signup") => set({ authOpen: true, authMode: mode, authError: "" }),
  closeAuth: () => set({ authOpen: false, authError: "" }),
  toggleAuthMode: () =>
    set((s) => ({ authMode: s.authMode === "signup" ? "signin" : "signup", authError: "" })),
  setAuthError: (msg) => set({ authError: msg }),
  setAuthBusy: (v) => set({ authBusy: v }),
  setImport: (open, count) =>
    set((s) => ({ importOpen: open, importCount: count ?? s.importCount })),
  openSettings: () => set({ settingsOpen: true, settingsView: "menu", accountMenuOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsView: (v) => set({ settingsView: v }),
  setSyncBusy: (v) => set({ syncBusy: v }),
  setStorageUsed: (v) => set({ storageUsed: v }),
  pushToast: (message) =>
    set((s) => {
      if (s.toasts.some((t) => t.message === message)) return s; // no duplicate spam
      const id = ++toastSeq;
      setTimeout(() => useUi.getState().dismissToast(id), TOAST_TTL);
      return { toasts: [...s.toasts, { id, message }] };
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function initialsFor(email: string): string {
  const n = (email || "").split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return (n.slice(0, 2) || "??").toUpperCase();
}
