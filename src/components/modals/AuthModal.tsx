"use client";

import { useState } from "react";
import { EqIcon } from "@/components/icons";
import { submitAuth } from "@/store/sync";
import { useUi } from "@/store/ui";

export function AuthModal() {
  const open = useUi((s) => s.authOpen);
  const mode = useUi((s) => s.authMode);
  const error = useUi((s) => s.authError);
  const busy = useUi((s) => s.authBusy);
  const closeAuth = useUi((s) => s.closeAuth);
  const toggleMode = useUi((s) => s.toggleAuthMode);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  if (!open) return null;

  const submit = () => {
    if (busy) return;
    void submitAuth(email, pass).then(() => {
      if (!useUi.getState().authOpen) setPass("");
    });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      onClick={closeAuth}
      className="fixed inset-0 z-60 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(400px,100%)] rounded-[16px] border border-white/10 bg-raised p-[26px] shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[6px] flex items-center gap-[10px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-gradient-to-br from-accent-2 to-accent-3 shadow-[0_2px_10px_rgba(45,212,191,.35)]">
            <EqIcon size={17} />
          </div>
          <h2 className="m-0 text-[18px] font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
        </div>
        <p className="mb-[18px] mt-0 text-[13px] leading-[1.5] text-muted">
          Save your loops and open them on any device. It&apos;s free.
        </p>

        <div className="flex flex-col gap-[10px]">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKey}
            type="email"
            placeholder="you@example.com"
            className="h-[42px] rounded-[9px] border border-white/10 bg-field px-[13px] text-[13.5px] text-ink focus:border-accent"
          />
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={onKey}
            type="password"
            placeholder="Password"
            className="h-[42px] rounded-[9px] border border-white/10 bg-field px-[13px] text-[13.5px] text-ink focus:border-accent"
          />
          {error && <span className="text-[12px] text-src-youtube">{error}</span>}
          <button
            onClick={submit}
            disabled={busy}
            className="mt-[2px] h-11 cursor-pointer rounded-[9px] border-none bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60"
          >
            {busy ? "…" : mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </div>

        <div className="mt-4 text-center text-[12.5px] text-muted-3">
          {mode === "signup" ? "Already have an account?" : "New to multi-looper?"}
          <button
            onClick={toggleMode}
            className="cursor-pointer border-none bg-transparent px-[2px] text-[12.5px] font-semibold text-accent"
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
