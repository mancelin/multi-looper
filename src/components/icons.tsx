import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const svg = (size: number | undefined, fallback: number, rest: SVGProps<SVGSVGElement>) => ({
  width: size ?? fallback,
  height: size ?? fallback,
  fill: "none" as const,
  ...rest,
});

export function BookIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 16, rest)}>
      <path
        d="M8 3.2C6.9 2.35 5.4 2 3.6 2c-.55 0-1.08.05-1.6.15v10.7c.52-.1 1.05-.15 1.6-.15 1.8 0 3.3.35 4.4 1.15 1.1-.8 2.6-1.15 4.4-1.15.55 0 1.08.05 1.6.15V2.15C13.48 2.05 12.95 2 12.4 2 10.6 2 9.1 2.35 8 3.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 3.4v10.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function EqIcon({ size, stroke = "#04231f", ...rest }: P & { stroke?: string }) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 15, rest)}>
      <path d="M4 3v10M8 1v14M12 5v6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function YoutubeIcon({ size, hole = "#0e1116", ...rest }: P & { hole?: string }) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <path
        d="M22 12s0-3.6-.46-5.3a2.78 2.78 0 0 0-1.95-1.96C17.9 4.28 12 4.28 12 4.28s-5.9 0-7.6.46A2.78 2.78 0 0 0 2.46 6.7C2 8.4 2 12 2 12s0 3.6.46 5.3a2.78 2.78 0 0 0 1.95 1.96c1.7.46 7.6.46 7.6.46s5.9 0 7.6-.46a2.78 2.78 0 0 0 1.95-1.96C22 15.6 22 12 22 12Z"
        fill="currentColor"
      />
      <path d="M10 15V9l5 3-5 3Z" fill={hole} />
    </svg>
  );
}

export function UploadIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 15, rest)}>
      <path
        d="M8 10.5V2.5M8 2.5 5 5.5M8 2.5l3 3M2.5 10v2.5A1 1 0 0 0 3.5 13.5h9a1 1 0 0 0 1-1V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KeyboardIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 17, rest)}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M7.5 13h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 14, rest)}>
      <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function NoteIcon({ size, strokeWidth = 1.7, ...rest }: P & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 20, rest)}>
      <path
        d="M9 18V6l10-2v12"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function CloseIcon({ size, strokeWidth = 1.5, ...rest }: P & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 13, rest)}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function ShareIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 14, rest)}>
      <circle cx="12" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 7 10.2 4.5M5.8 9l4.4 2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PlusIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 14, rest)}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PlayIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 22, rest)} fill="currentColor">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

export function PauseIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 22, rest)} fill="currentColor">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

export function PrevIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 17, rest)} fill="currentColor">
      <path d="M6 5v14h2V5H6Zm3 7 9 7V5l-9 7Z" />
    </svg>
  );
}

export function NextIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 17, rest)} fill="currentColor">
      <path d="M16 5v14h2V5h-2ZM6 5v14l9-7-9-7Z" />
    </svg>
  );
}

export function LoopIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 16, rest)}>
      <path
        d="M17 3l4 4-4 4M21 7H7a4 4 0 0 0-4 4v0M7 21l-4-4 4-4M3 17h14a4 4 0 0 0 4-4v0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 16, rest)}>
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function VolumeIcon({ size, muted = false, ...rest }: P & { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 16, rest)}>
      <path
        d="M11 5.5 6.8 9H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.8l4.2 3.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <>
          <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M17 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function UserIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function SignOutIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <path
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ImportIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 22, rest)}>
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GearIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 16, rest)}>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.12-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.84a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KeyIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <circle cx="7.5" cy="15.5" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m10.5 12.5 8-8M15 7.5l2.5 2.5M18 4.5 20.5 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InfoIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <path
        d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" {...svg(size, 15, rest)}>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 13, rest)}>
      <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BackIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 13, rest)}>
      <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResizeIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 12, rest)}>
      <path d="M14 6L6 14M14 11l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
