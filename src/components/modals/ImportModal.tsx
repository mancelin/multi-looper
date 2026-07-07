"use client";

import { ImportIcon } from "@/components/icons";
import { importGuestLibrary, skipImport } from "@/store/sync";
import { useUi } from "@/store/ui";

export function ImportModal() {
  const open = useUi((s) => s.importOpen);
  const count = useUi((s) => s.importCount);
  if (!open) return null;

  const one = count === 1;
  const countLabel = one ? "1 track" : `${count} tracks`;
  const them = one ? "it" : "them";

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]">
      <div className="w-[min(420px,100%)] rounded-[16px] border border-white/10 bg-raised p-[26px] shadow-[0_24px_70px_rgba(0,0,0,.6)]">
        <div className="mb-[14px] flex h-11 w-11 items-center justify-center rounded-[12px] border border-[rgba(94,234,212,.25)] bg-[rgba(94,234,212,.1)] text-accent">
          <ImportIcon />
        </div>
        <h2 className="mb-2 mt-0 text-[18px] font-bold">Import your loops?</h2>
        <p className="mb-5 mt-0 text-[13.5px] leading-[1.55] text-muted">
          You added <strong className="text-ink">{countLabel}</strong> before signing in. Add {them}{" "}
          to your account to open {them} on any device?
        </p>
        <div className="flex gap-[10px]">
          <button
            onClick={skipImport}
            className="h-11 flex-1 cursor-pointer rounded-[9px] border border-white/10 bg-field text-[13.5px] font-semibold text-ink-2"
          >
            Don&apos;t import
          </button>
          <button
            onClick={importGuestLibrary}
            className="h-11 flex-1 cursor-pointer rounded-[9px] border-none bg-accent text-[13.5px] font-semibold text-on-accent"
          >
            Import {countLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
