<h1><img src="src/app/icon.svg" alt="" width="32" height="32" align="top"> multi-looper</h1>

Dark, DAW-style web app for practicing along to music by looping sections of a track. Load a YouTube link or a local audio/video file, set precise A/B loop points on a real waveform, and repeat the section indefinitely, optionally slowed down with pitch preserved.

**The code is free software; the hosted service costs money to run.** Run your own copy and it costs you nothing but your own server. [multi-looper.com](https://multi-looper.com) is operated and paid for by the author: free to use, with a storage quota per account, and it may gain a paid tier for accounts that need more space, since media storage is the one cost that scales with users. Nothing is ever paywalled in the code itself; the quota lives in the server hook (`pb/pb_hooks/quota.pb.js`) and any self-hosted instance sets its own.

## Stack

- Next.js (app router, TypeScript) + Tailwind CSS v4
- Zustand for state
- PocketBase for auth + library sync (optional, the app is fully usable without an account)

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

- **Tracks & loops**: each track holds ≥1 named loops (`a`/`b` in seconds, kept sorted by start). All A/B editing goes through the active loop.
- **Playback**: a single clock source per track (`src/lib/player/controller.ts`): YouTube IFrame API (`controls:0`, app transport is the only control) or a `<video>` element for local files. A `requestAnimationFrame` watcher enforces the A→B loop; playhead and time readout update imperatively so React never renders at frame rate.
- **Waveform**: local files are decoded with Web Audio into 600 max-abs peaks; YouTube tracks get synthetic peaks. Bars inside the loop region are painted the track accent.
- **Persistence**: guests keep the library mirrored to `localStorage`, with local file blobs in IndexedDB, re-registered on boot. Signed in: per-track records in the PocketBase `tracks` collection, media files uploaded to PocketBase storage so file tracks are fully playable on any device. Guest tracks can be imported into the account at sign-in.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `L` | Toggle loop |
| `A` | Set loop start at playhead |
| `B` | Set loop end at playhead |
| `←` / `→` | Seek −0.25 / +0.25 s |
| `↑` / `↓` | Speed +5% / −5% |
| `<` / `>` | Previous / next song |
| `[` / `]` | Previous / next loop |
| `N` | Add loop at playhead |
| `R` | Play from loop start |
| `Ctrl+Z` | Undo loop edit |
| `Ctrl+Shift+Z` | Redo loop edit |
| `S` | Show / hide shortcuts |

The same list is in the app behind the ⌨ button in the top bar. Shortcuts are ignored while a text field, the record modal or a confirmation dialog has focus.

## Contributing

Pull requests welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first (setup, `just ci` via [just](https://github.com/casey/just), the e2e-test requirement, and the invariants around the player clock and loop editing).

**Every merged contributor is credited in the app**: your GitHub account goes into [CONTRIBUTORS.md](CONTRIBUTORS.md) and shows up in the Contributors list under Settings → App info.

## License

Copyright (C) 2026 Maxime Ancelin.

multi-looper is free software under the **GNU Affero General Public License, version 3 or later**. See [LICENSE](LICENSE). If you run a modified copy as a network service, the AGPL requires you to offer your users its source.

### Name and branding

The AGPL covers the **code**, and nothing else. The name *multi-looper*, the logo and the domain `multi-looper.com` are not part of the licensed work and no rights to them are granted.

The license permits a fork to be hosted commercially, provided it publishes its changes as the AGPL requires. It must also carry its own name and icon, and must not present itself as multi-looper or imply it is run by the author. Unmodified copies may of course say what they are ("a self-hosted instance of multi-looper"), and a link back to [the original project](https://github.com/mancelin/multi-looper) alongside that is appreciated. Forks are welcome to credit their origin the same way.
