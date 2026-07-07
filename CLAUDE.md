# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Dark, DAW-style web app for practicing along to music by looping A/B sections of a track (YouTube link or local audio/video file), optionally slowed down. Single-page client app — everything under `src/` is `"use client"`; there is no server code besides the optional PocketBase backend.

## Commands

```bash
bun install
bun dev                # dev server at http://localhost:3000
bun run build          # production build
bun run lint           # eslint
npx tsc --noEmit       # typecheck (no test suite exists)
docker compose up -d   # PocketBase at http://127.0.0.1:8090 (optional; app works without it)
cp .env.example .env   # NEXT_PUBLIC_POCKETBASE_URL
```

Stack: Next.js app router + TypeScript, Tailwind CSS v4, Zustand, PocketBase (auth + library sync, optional).

## Architecture

Data model (`src/lib/types.ts`): a `Track` holds ≥1 named `Loop`s (`a`/`b` in seconds, kept sorted by `a`); `activeLoopId` picks the loop all A/B editing applies to. `id` is a client uid; `pbId` is set once synced to PocketBase.

Three Zustand stores in `src/store/`:
- `library.ts` — tracks, current track, all track/loop mutations. Uses `subscribeWithSelector` so the persistence layers can watch it.
- `ui.ts` — playback UI state (playing, rate, loopEnabled), layout, modals, auth/account state.
- `sync.ts` + `guestPersist.ts` — two mutually exclusive persistence layers subscribed to `library`. Guests: library mirrored to `localStorage` (object URLs/`pbId` stripped; local file blobs can't survive reload — such tracks keep metadata but need re-upload to play). Signed in: per-track records in the PocketBase `tracks` collection (schema in `pb/pb_migrations/`), media files uploaded to PB storage; `sync.ts` diffs by fingerprint on store changes. `bootAuth()` in `page.tsx` picks the mode; guest tracks can be imported at sign-in via `ImportModal`.

Playback (`src/lib/player/controller.ts`): singleton `player` outside React — the single clock source per track. Backends: YouTube IFrame API (`controls:0`; app transport is the only control) or a `<video>` element for local files (also audio). A `requestAnimationFrame` tick reads media time and enforces the A→B loop; playhead/time readout update **imperatively** via `player.onTime()` listeners so React never renders at frame rate — keep it that way. Real durations arrive late (YT placeholder 210s, failed decode 120s) and flow through `library.patchDuration`, which re-clamps loops and keeps full-span loops full.

Ingest (`src/store/ingest.ts`): creates `Track` objects from YouTube URLs or dropped files. Local files are decoded with Web Audio into 600 max-abs peaks (`lib/peaks.ts`); YouTube gets synthetic peaks (`lib/youtube.ts`). Original `File` objects live in the in-memory `lib/fileRegistry.ts` (not serializable) — the sync layer reads from there when uploading media after sign-in. New tracks start with one full-track loop (a=0, b=duration).

Loop editing: all clamped A/B operations (set/nudge, min gap 0.05s) live in `src/lib/loopEdit.ts`, shared by UI buttons and keyboard shortcuts (`components/ShortcutsProvider.tsx`). Don't patch `a`/`b` directly from components — go through `loopEdit` or `library.patchActiveLoop`.

UI composition: `app/page.tsx` → `TopBar` + `Sidebar` (library) + `PlayerMain` (`TrackHeader`, `VideoPanel`, `Waveform`, `LoopStrip`, `LoopTrim`, `Transport`) + modals. `Waveform` paints bars inside the loop region with the track accent color.
