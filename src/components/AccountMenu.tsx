"use client";

import { useEffect, useRef } from "react";
import { GearIcon, SignOutIcon, UserIcon } from "@/components/icons";
import { signOut } from "@/store/sync";
import { initialsFor, useUi } from "@/store/ui";

export function AccountArea() {
  const account = useUi((s) => s.account);
  const openAuth = useUi((s) => s.openAuth);
  const openSettings = useUi((s) => s.openSettings);
  const menuOpen = useUi((s) => s.accountMenuOpen);
  const setMenuOpen = useUi((s) => s.setAccountMenuOpen);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen, setMenuOpen]);

  if (!account) {
    return (
      <button
        onClick={openAuth}
        title="Sign in"
        className="flex h-[38px] flex-none cursor-pointer items-center gap-[7px] rounded-[9px] bg-accent px-[11px] text-[13px] font-semibold text-on-accent min-[420px]:px-[15px]"
      >
        <UserIcon />
        <span className="hidden min-[420px]:inline">Sign in</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex-none">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        title={account.email}
        className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] border border-white/9 bg-field pl-2 pr-[6px]"
      >
        <span className="flex items-center gap-[5px] text-[10px] font-semibold tracking-[.04em] text-accent">
          <span className="h-[6px] w-[6px] rounded-full bg-accent-2 shadow-[0_0_6px_rgba(45,212,191,.8)]" />
          SYNCED
        </span>
        <span className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] bg-gradient-to-br from-accent-2 to-accent-3 text-[12px] font-bold text-on-accent-2">
          {initialsFor(account.email)}
        </span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-[46px] z-40 w-[230px] rounded-[12px] border border-white/10 bg-raised p-[6px] shadow-[0_18px_50px_rgba(0,0,0,.55)]">
          <div className="mb-[5px] flex flex-col gap-[2px] border-b border-white/6 px-[10px] pb-[11px] pt-[10px]">
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-ink">
              {account.email}
            </span>
            <span className="flex items-center gap-[5px] text-[11px] text-accent">
              <span className="h-[5px] w-[5px] rounded-full bg-accent-2" />
              All loops synced
            </span>
          </div>
          <button
            onClick={openSettings}
            className="flex w-full cursor-pointer items-center gap-[9px] rounded-[8px] px-[10px] py-[9px] text-left text-[13px] text-ink-2 hover:bg-white/5"
          >
            <GearIcon className="text-muted" />
            Settings
          </button>
          <button
            onClick={() => void signOut()}
            className="flex w-full cursor-pointer items-center gap-[9px] rounded-[8px] px-[10px] py-[9px] text-left text-[13px] text-ink-2 hover:bg-white/5"
          >
            <SignOutIcon className="text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
