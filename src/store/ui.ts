"use client";

import { create } from "zustand";

export interface Account {
  id: string;
  email: string;
}

export type AuthMode = "signup" | "signin";

export interface Toast {
  id: number;
  message: string;
}

export interface UiState {
  playing: boolean;
  rate: number;
  loopEnabled: boolean;
  narrow: boolean;
  sidebarOpen: boolean;
  videoWidth: number;
  showShortcuts: boolean;
  ytModalOpen: boolean;

  account: Account | null;
  accountMenuOpen: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  authError: string;
  authBusy: boolean;
  importOpen: boolean;
  /** number of guest tracks pending the import decision */
  importCount: number;
  syncBusy: boolean;
  toasts: Toast[];

  setPlaying: (v: boolean) => void;
  setRate: (v: number) => void;
  toggleLoop: () => void;
  setNarrow: (v: boolean) => void;
  toggleSidebar: () => void;
  setVideoWidth: (w: number) => void;
  toggleShortcuts: () => void;
  setYtModalOpen: (v: boolean) => void;

  setAccount: (a: Account | null) => void;
  setAccountMenuOpen: (v: boolean) => void;
  openAuth: () => void;
  closeAuth: () => void;
  toggleAuthMode: () => void;
  setAuthError: (msg: string) => void;
  setAuthBusy: (v: boolean) => void;
  setImport: (open: boolean, count?: number) => void;
  setSyncBusy: (v: boolean) => void;
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;
const TOAST_TTL = 6000;

export const useUi = create<UiState>()((set) => ({
  playing: false,
  rate: 1,
  loopEnabled: true,
  narrow: false,
  sidebarOpen: true,
  videoWidth: 620,
  showShortcuts: false,
  ytModalOpen: false,

  account: null,
  accountMenuOpen: false,
  authOpen: false,
  authMode: "signup",
  authError: "",
  authBusy: false,
  importOpen: false,
  importCount: 0,
  syncBusy: false,
  toasts: [],

  setPlaying: (v) => set({ playing: v }),
  setRate: (v) => set({ rate: v }),
  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),
  // entering narrow closes the drawer, leaving it restores the docked sidebar
  setNarrow: (v) => set((s) => (s.narrow === v ? s : { narrow: v, sidebarOpen: !v })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setVideoWidth: (w) => set({ videoWidth: w }),
  toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
  setYtModalOpen: (v) => set({ ytModalOpen: v }),

  setAccount: (a) => set({ account: a }),
  setAccountMenuOpen: (v) => set({ accountMenuOpen: v }),
  openAuth: () => set({ authOpen: true, authMode: "signup", authError: "" }),
  closeAuth: () => set({ authOpen: false, authError: "" }),
  toggleAuthMode: () =>
    set((s) => ({ authMode: s.authMode === "signup" ? "signin" : "signup", authError: "" })),
  setAuthError: (msg) => set({ authError: msg }),
  setAuthBusy: (v) => set({ authBusy: v }),
  setImport: (open, count) =>
    set((s) => ({ importOpen: open, importCount: count ?? s.importCount })),
  setSyncBusy: (v) => set({ syncBusy: v }),
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
