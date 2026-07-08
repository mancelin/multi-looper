"use client";

import { CloseIcon } from "@/components/icons";
import { useUi } from "@/store/ui";

/** Bottom-centered stack of error toasts (auto-dismiss, click to close). */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          data-testid="toast"
          className="pointer-events-auto flex items-start gap-3 rounded-[12px] border border-danger/40 bg-[rgba(22,12,15,.94)] px-4 py-3 text-[13px] leading-snug text-white shadow-[0_8px_30px_rgba(0,0,0,.5)]"
        >
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            title="Dismiss"
            className="flex h-5 w-5 flex-none cursor-pointer items-center justify-center rounded-[6px] text-muted transition-colors hover:text-white"
          >
            <CloseIcon size={11} strokeWidth={1.8} />
          </button>
        </div>
      ))}
    </div>
  );
}
