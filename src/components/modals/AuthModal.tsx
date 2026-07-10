"use client";

import { useState } from "react";
import { EqIcon } from "@/components/icons";
import { signInWithGoogle, submitAuth } from "@/store/sync";
import { useUi } from "@/store/ui";

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.4 44 30.1 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

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

          <div className="flex items-center gap-[10px] text-[11px] uppercase tracking-wider text-muted-3">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={() => void signInWithGoogle()}
            disabled={busy}
            className="flex h-11 cursor-pointer items-center justify-center gap-[10px] rounded-[9px] border border-white/10 bg-field text-[14px] font-semibold text-ink disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
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
