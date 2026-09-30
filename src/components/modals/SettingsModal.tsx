"use client";

import { useState } from "react";
import {
  BackIcon,
  ChevronRightIcon,
  DocIcon,
  InfoIcon,
  KeyIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
} from "@/components/icons";
import {
  APP_NAME,
  APP_VERSION,
  AUTHOR_NAME,
  AUTHOR_URL,
  CONTACT_EMAIL,
  CONTRIBUTING_URL,
  CONTRIBUTORS,
  LICENSE_NAME,
  LICENSE_URL,
  REPO_URL,
} from "@/lib/appInfo";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";
import { TermsOfService } from "@/components/legal/TermsOfService";
import { changePassword, deleteAccount, deleteAllData } from "@/store/sync";
import { useUi, type SettingsView } from "@/store/ui";

const TITLES: Record<SettingsView, string> = {
  menu: "Settings",
  password: "Change password",
  info: "App info",
  privacy: "Privacy policy",
  terms: "Terms of service",
};

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-[10px] rounded-[8px] px-[10px] py-[10px] text-left text-[13px] hover:bg-white/5 ${
        danger ? "text-danger" : "text-ink-2"
      }`}
    >
      <span className={danger ? "text-danger" : "text-muted"}>{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRightIcon className="text-muted-4" />
    </button>
  );
}

function ConfirmRow({
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mx-[4px] my-[4px] rounded-[10px] border border-danger/30 bg-danger/8 p-3">
      <p className="m-0 mb-[10px] text-[12.5px] leading-[1.5] text-ink-3">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="h-[34px] flex-1 cursor-pointer rounded-[8px] border border-white/10 bg-field text-[12.5px] font-medium text-ink disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="h-[34px] flex-1 cursor-pointer rounded-[8px] border-none bg-danger text-[12.5px] font-semibold text-[#3b0d0d] disabled:opacity-60"
        >
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function PasswordView({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (busy) return;
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setError("");
    setBusy(true);
    void changePassword(current, next).then((err) => {
      setBusy(false);
      if (err) setError(err);
      else onDone();
    });
  };

  const field =
    "h-[42px] rounded-[9px] border border-white/10 bg-field px-[13px] text-[13.5px] text-ink focus:border-accent";

  return (
    <div className="flex flex-col gap-[10px] px-[4px]">
      <input
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        type="password"
        placeholder="Current password"
        className={field}
      />
      <input
        value={next}
        onChange={(e) => setNext(e.target.value)}
        type="password"
        placeholder="New password"
        className={field}
      />
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        type="password"
        placeholder="Repeat new password"
        className={field}
      />
      {error && <span className="text-[12px] text-danger">{error}</span>}
      <button
        onClick={submit}
        disabled={busy}
        className="mt-[2px] h-11 cursor-pointer rounded-[9px] border-none bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60"
      >
        {busy ? "…" : "Change password"}
      </button>
      <p className="m-0 text-[11.5px] leading-[1.5] text-muted-3">
        Signed up with Google? Your account has no password to change. Keep signing in
        with Google.
      </p>
    </div>
  );
}

function InfoView() {
  return (
    <div className="max-h-[50vh] overflow-y-auto px-[4px] text-[13px] leading-[1.6] text-ink-3">
      <p className="m-0 mb-2">
        <span className="font-semibold text-ink">{APP_NAME}</span>{" "}
        <span className="tno text-muted">v{APP_VERSION}</span>
      </p>
      <p className="m-0 mb-2">
        A practice tool for musicians: loop A/B sections of any track (a YouTube link or a local
        audio/video file) and slow them down until they sit under your fingers.
      </p>
      <p className="m-0 mb-2 text-muted">
        Works fully offline as a guest; an optional free account syncs your library across
        devices.
      </p>
      <p className="m-0 mb-2 text-muted">
        Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p className="m-0 mb-2 text-muted">
        App by{" "}
        <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
          {AUTHOR_NAME}
        </a>
      </p>
      <p className="m-0 mb-2 text-muted">
        Source:{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          github.com/mancelin/multi-looper
        </a>
      </p>
      <h3 className="mb-1 mt-3 text-[13px] font-semibold text-ink">Contributors</h3>
      {CONTRIBUTORS.length > 0 ? (
        <p className="m-0 mb-2 text-muted">
          {CONTRIBUTORS.map((c, i) => (
            <span key={c.url}>
              {i > 0 && ", "}
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {c.name}
              </a>
            </span>
          ))}
        </p>
      ) : (
        <p className="m-0 mb-2 text-muted">
          Nobody but the author yet. Everyone with a merged pull request is listed here.
        </p>
      )}
      <p className="m-0 mb-2 text-muted">
        Want your name here?{" "}
        <a href={CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer">
          Contributing guide
        </a>
      </p>
      <p className="m-0 text-[11.5px] leading-[1.5] text-muted-3">
        © {new Date().getFullYear()} {AUTHOR_NAME} and contributors. Free software under the{" "}
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
          {LICENSE_NAME}
        </a>
        .
      </p>
    </div>
  );
}

function PrivacyView() {
  return (
    <div className="max-h-[50vh] overflow-y-auto px-[4px] text-[12.5px] leading-[1.6] text-ink-3">
      <PrivacyPolicy />
    </div>
  );
}

function TermsView() {
  return (
    <div className="max-h-[50vh] overflow-y-auto px-[4px] text-[12.5px] leading-[1.6] text-ink-3">
      <TermsOfService />
    </div>
  );
}

export function SettingsModal() {
  const open = useUi((s) => s.settingsOpen);
  const view = useUi((s) => s.settingsView);
  const account = useUi((s) => s.account);
  const close = useUi((s) => s.closeSettings);
  const setView = useUi((s) => s.setSettingsView);
  const [confirm, setConfirm] = useState<"data" | "account" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setConfirm(null);
    setError("");
  };

  const runDelete = (op: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    void op().then((err) => {
      setBusy(false);
      if (err) setError(err);
      else {
        reset();
        close();
      }
    });
  };

  return (
    <div
      onClick={() => {
        reset();
        close();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-[rgba(6,8,11,.72)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(440px,100%)] rounded-[16px] border border-white/10 bg-raised p-[18px] shadow-[0_24px_70px_rgba(0,0,0,.6)]"
      >
        <div className="mb-3 flex items-center gap-[10px] px-[4px]">
          {view !== "menu" && (
            <button
              onClick={() => {
                reset();
                setView("menu");
              }}
              title="Back"
              className="flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center rounded-[8px] border border-white/10 bg-field-2 text-muted"
            >
              <BackIcon />
            </button>
          )}
          <h2 className="m-0 flex-1 text-[16px] font-semibold">{TITLES[view]}</h2>
          <button
            onClick={() => {
              reset();
              close();
            }}
            className="h-[30px] w-[30px] flex-none cursor-pointer rounded-[8px] border border-white/10 bg-field-2 text-muted"
          >
            ✕
          </button>
        </div>

        {view === "menu" && (
          <div className="flex flex-col gap-[2px]">
            {account && (
              <div className="mb-[6px] border-b border-white/6 px-[10px] pb-[10px] text-[12px] text-muted">
                Signed in as <span className="font-semibold text-ink-2">{account.email}</span>
              </div>
            )}
            {account && (
              <MenuItem
                icon={<KeyIcon />}
                label="Change password"
                onClick={() => setView("password")}
              />
            )}
            {confirm === "data" ? (
              <ConfirmRow
                message={
                  account
                    ? "Deletes every track from your library, on this device and on the sync server. Your account stays."
                    : "Deletes every track stored on this device. This cannot be undone."
                }
                confirmLabel="Delete all data"
                busy={busy}
                onConfirm={() => runDelete(deleteAllData)}
                onCancel={reset}
              />
            ) : (
              <MenuItem
                icon={<TrashIcon />}
                label="Delete all data"
                danger
                onClick={() => {
                  setError("");
                  setConfirm("data");
                }}
              />
            )}
            {account &&
              (confirm === "account" ? (
                <ConfirmRow
                  message="Permanently deletes your account and everything stored with it: synced tracks, uploaded media, all of it. This cannot be undone."
                  confirmLabel="Delete account"
                  busy={busy}
                  onConfirm={() => runDelete(deleteAccount)}
                  onCancel={reset}
                />
              ) : (
                <MenuItem
                  icon={<UserIcon />}
                  label="Delete account"
                  danger
                  onClick={() => {
                    setError("");
                    setConfirm("account");
                  }}
                />
              ))}
            {error && <span className="px-[10px] py-1 text-[12px] text-danger">{error}</span>}
            <div className="my-[6px] h-px bg-white/6" />
            <MenuItem icon={<InfoIcon />} label="App info" onClick={() => setView("info")} />
            <MenuItem
              icon={<ShieldIcon />}
              label="Privacy policy"
              onClick={() => setView("privacy")}
            />
            <MenuItem
              icon={<DocIcon />}
              label="Terms of service"
              onClick={() => setView("terms")}
            />
          </div>
        )}

        {view === "password" && <PasswordView onDone={close} />}
        {view === "info" && <InfoView />}
        {view === "privacy" && <PrivacyView />}
        {view === "terms" && <TermsView />}
      </div>
    </div>
  );
}
