"use client";

import { useState } from "react";
import { TidalIcon } from "@/components/icons";
import { connectTidal, disconnectTidal, tidalConfigured } from "@/lib/tidal";
import { addTidalUrl } from "@/store/ingest";
import { useUi } from "@/store/ui";

export function TidalModal() {
  const open = useUi((s) => s.tidalModalOpen);
  if (!open) return null;
  return <TidalModalContent />;
}

/** Mounted only while open, so url/error state starts fresh each time. */
function TidalModalContent() {
  const setOpen = useUi((s) => s.setTidalModalOpen);
  const connected = useUi((s) => s.tidalConnected);
  const pushToast = useUi((s) => s.pushToast);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => setOpen(false);
  const submit = () => {
    if (!url.trim()) return;
    if (addTidalUrl(url)) {
      close();
    } else {
      setError(true);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      await connectTidal(); // leaves the page on success
    } catch {
      setBusy(false);
      pushToast("Couldn't reach TIDAL — try again.");
    }
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised px-[26px] py-6 shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[rgba(103,232,249,.25)] bg-[rgba(103,232,249,.1)] text-[#67e8f9]">
              <TidalIcon size={15} />
            </span>
            <h2 className="m-0 text-[17px] font-semibold">Add a TIDAL link</h2>
          </div>
          <button
            onClick={close}
            className="h-[30px] w-[30px] cursor-pointer rounded-[8px] border border-white/10 bg-field-2 text-muted"
          >
            ✕
          </button>
        </div>
        <div className="flex h-10 items-center gap-2 rounded-[9px] border border-white/9 bg-field px-[11px]">
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") close();
            }}
            placeholder="tidal.com/track/…"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink"
          />
          <button
            onClick={submit}
            className="flex-none cursor-pointer rounded-[6px] bg-accent px-3 py-[7px] text-[12px] font-semibold text-on-accent"
          >
            Add
          </button>
        </div>
        {error && (
          <p className="mb-0 mt-[10px] text-[12.5px] text-danger">
            That doesn&apos;t look like a TIDAL track link.
          </p>
        )}
        <div className="mt-[18px] border-t border-white/8 pt-[14px]">
          {!tidalConfigured() ? (
            <p className="m-0 text-[12.5px] text-muted">
              TIDAL playback isn&apos;t configured: set{" "}
              <code className="text-ink-2">NEXT_PUBLIC_TIDAL_CLIENT_ID</code> (from{" "}
              developer.tidal.com) to enable it.
            </p>
          ) : connected ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted">
                TIDAL account connected — tracks play through your subscription.
              </span>
              <button
                onClick={() => void disconnectTidal()}
                className="flex-none cursor-pointer rounded-[7px] border border-white/10 bg-field-2 px-3 py-[6px] text-[12px] text-muted"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted">
                Playback needs your tidal.com account (with a TIDAL subscription).
              </span>
              <button
                onClick={() => void connect()}
                disabled={busy}
                className="flex-none cursor-pointer rounded-[7px] bg-accent px-3 py-[6px] text-[12px] font-semibold text-on-accent disabled:opacity-60"
              >
                {busy ? "Opening…" : "Connect TIDAL"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
