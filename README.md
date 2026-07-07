# multi-looper

Dark, DAW-style web app for practicing along to music by looping sections of a track. Load a YouTube link or a local audio/video file, set precise A/B loop points on a real waveform, and repeat the section indefinitely — optionally slowed down with pitch preserved.

Built from the design handoff in `design_handoff_multi-looper/`.

## Stack

- Next.js (app router, TypeScript) + Tailwind CSS v4
- Zustand for state
- PocketBase for auth + library sync (optional — the app is fully usable without an account)

## Run

```bash
cp .env.example .env      # NEXT_PUBLIC_POCKETBASE_URL (default: http://127.0.0.1:8090)
docker compose up -d      # starts PocketBase, applies migrations from pb/pb_migrations/
bun install
bun dev                   # http://localhost:3000
```

Optional PocketBase admin UI: create a superuser with
`docker exec -it multilooper-pocketbase /pb/pocketbase superuser upsert you@example.com yourpassword --dir=/pb_data`, then open http://127.0.0.1:8090/_/.

## How it works

- **Tracks & loops** — each track holds ≥1 named loops (`a`/`b` in seconds, kept sorted by start). All A/B editing goes through the active loop.
- **Playback** — a single clock source per track (`src/lib/player/controller.ts`): YouTube IFrame API (`controls:0`, app transport is the only control) or a `<video>` element for local files. A `requestAnimationFrame` watcher enforces the A→B loop; playhead and time readout update imperatively so React never renders at frame rate.
- **Waveform** — local files are decoded with Web Audio into 600 max-abs peaks; YouTube tracks get synthetic peaks. Bars inside the loop region are painted the track accent.
- **Persistence** — guests: library mirrored to `localStorage` (local file blobs can't survive a reload — such tracks keep loops/metadata but need re-upload to play). Signed in: per-track records in the PocketBase `tracks` collection, media files uploaded to PocketBase storage so file tracks are fully playable on any device. Guest tracks can be imported into the account at sign-in.

## Keyboard shortcuts

Space play/pause · L loop toggle · A/B set loop start/end at playhead · Q/W trim start ∓10ms · O/P trim end ∓10ms · ←/→ seek ∓5s · ↑/↓ speed ±5% · &lt;/&gt; prev/next song · [ / ] prev/next loop · N add loop. Full list: the ⌨ button in the top bar.
