# Data Model, Stores & Persistence

Data model (`src/lib/types.ts`): a `Track` holds ≥1 named `Loop`s (`a`/`b` in seconds, kept sorted by `a`); `activeLoopId` picks the loop all A/B editing applies to. `id` is a client uid; `pbId` is set once synced to PocketBase.

Three Zustand stores in `src/store/`:
- `library.ts` — tracks, current track, all track/loop mutations. Uses `subscribeWithSelector` so the persistence layers can watch it.
- `ui.ts` — playback UI state (playing, rate, loopEnabled), layout, modals, auth/account state.
- `sync.ts` + `guestPersist.ts` — two mutually exclusive persistence layers subscribed to `library`. Guests: library mirrored to `localStorage` (object URLs/`pbId` stripped; local file blobs can't survive reload — such tracks keep metadata but need re-upload to play). Signed in: per-track records in the PocketBase `tracks` collection (schema in `pb/pb_migrations/`), media files uploaded to PB storage; `sync.ts` diffs by fingerprint on store changes. `bootAuth()` in `page.tsx` picks the mode; guest tracks can be imported at sign-in via `ImportModal`.

Ingest (`src/store/ingest.ts`): creates `Track` objects from YouTube URLs or dropped files. Local files are decoded with Web Audio into 600 max-abs peaks (`lib/peaks.ts`); YouTube gets synthetic peaks (`lib/youtube.ts`). Original `File` objects live in the in-memory `lib/fileRegistry.ts` (not serializable) — the sync layer reads from there when uploading media after sign-in. New tracks start with one full-track loop (a=0, b=duration).
