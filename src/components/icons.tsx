import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const svg = (size: number | undefined, fallback: number, rest: SVGProps<SVGSVGElement>) => ({
  width: size ?? fallback,
  height: size ?? fallback,
  fill: "none" as const,
  ...rest,
});

export function MenuIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 16, rest)}>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

export function ResizeIcon({ size, ...rest }: P) {
  return (
    <svg viewBox="0 0 16 16" {...svg(size, 12, rest)}>
      <path d="M14 6L6 14M14 11l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
