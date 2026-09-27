# Contributing to multi-looper

Thanks for wanting to help. multi-looper is a practice tool for musicians: load a track, set A/B loop points on a real waveform, slow it down, repeat. Anything that makes that loop tighter, faster or easier to reach on a phone is welcome.

## Credit

**Every contributor whose pull request is merged is credited in the app itself.** Your GitHub account is added to [`CONTRIBUTORS.md`](CONTRIBUTORS.md) and to the **Contributors** list shown in **Settings → App info**, linked to your GitHub profile. One merged PR is enough, and a typo fix counts.

If you would rather not be listed, say so in the PR and you will be left out (or listed under a name you choose).

Maintainers: a merge means two edits, the entry in `CONTRIBUTORS.md` and the same entry in the `CONTRIBUTORS` array of [`src/lib/appInfo.ts`](src/lib/appInfo.ts), which is what the App info panel renders.

## License

The project is licensed under the **GNU Affero General Public License v3.0 or later** ([LICENSE](LICENSE)). AGPL was chosen on purpose: multi-looper is a web app, and the AGPL means anyone who runs a modified copy as a service has to publish their changes too.

By opening a pull request you agree that your contribution is licensed under AGPL-3.0-or-later, and that you have the right to license it (it is your own work, or you have permission). There is no CLA to sign and no copyright assignment, and you keep your copyright.

### Up front, so nobody is surprised later

`multi-looper.com` is run and paid for by the author, and media storage is the cost that grows with every user. The hosted service is free with a per-account quota today and may get a paid tier for larger quotas. Your contribution will therefore run on a service that someone may pay for. That is how AGPL hosting works, and it is written here so you know it before you start.

In exchange: the code stays AGPL, no feature is ever held back from the repo to be sold, and the quota is a server-side setting (`pb/pb_hooks/quota.pb.js`) that any self-hosted instance chooses for itself. If that trade doesn't suit you, better to know now than after writing a patch.

The name, logo and domain are not covered by the AGPL. See [Name and branding](README.md#name-and-branding) in the README before forking under the same name.

## Getting set up

```bash
just install                 # bun install
just env                     # cp .env.example .env
just dev                     # PocketBase (docker) + dev server at http://localhost:3000
```

`just` (with no recipe) lists everything. PocketBase is **optional**: the app is fully usable as a guest, with the library in `localStorage` and file blobs in IndexedDB. Only auth and cross-device sync need it (`just pb-up`).

Node/bun: the project builds with [bun](https://bun.sh). Android builds also need JDK 17+ and the Android SDK at `~/Android/Sdk` (see [`.claude/rules/commands.md`](.claude/rules/commands.md)).

## Before you push

```bash
just ci                      # lint + typecheck + e2e, must be green
```

Individually: `just lint`, `just check` (`tsc --noEmit`), `just e2e` (Playwright, starts its own dev server), `just e2e-one "play advances"` for a single test.

## Tests

**Every feature gets a Playwright e2e test in `e2e/`** covering its main user-visible flow, plus the interesting failure path when there is one. Reuse the helpers in `e2e/app.spec.ts` and `e2e/wav.ts`.

The suite must stay runnable offline and without PocketBase. A test that needs PB has to probe `http://127.0.0.1:8090/api/health` and `test.skip()` when it is unreachable. No test may depend on a real YouTube load.

## Architecture you should know before changing things

The full working notes live in [`.claude/rules/`](.claude/rules/): `commands.md`, `state-and-persistence.md`, `playback-and-ui.md`, `testing.md`. Read the relevant one before a non-trivial PR. The invariants that get broken most often:

- **Client-only.** Everything under `src/` is `"use client"`; there is no server code besides the optional PocketBase backend (`pb/`). Don't add API routes.
- **One clock per track.** `src/lib/player/controller.ts` exports a singleton `player` that lives outside React and owns playback (YouTube IFrame API, or a `<video>` element for local files). Don't add a second source of time.
- **Never render at frame rate.** The playhead, the time readout and the segment strip's ruler update *imperatively* through `player.onTime()` listeners. React only re-renders when something discrete changes (a boundary crossed, a button becoming usable). Keep it that way.
- **Loop edits go through `src/lib/loopEdit.ts`** (or `library.patchActiveLoop`), never by writing `a`/`b` from a component. Same for extra-media segments: the pure math is in `lib/extraMedia.ts`, the store-bound wrappers in `lib/extraMediaEdit.ts`.
- **`Track.extraMedia` is a gapless partition** of the track: sorted, first starting at 0, last ending at `duration`, exactly one segment visible at any time. Any edit must preserve that.
- **Durations arrive late** (YouTube placeholder 210s, failed decode 120s) and flow through `library.patchDuration`, which re-clamps loops and re-spans segments. Don't assume `duration` is final on first render.
- **Storage shapes are migrated, not broken.** Older tracks reach us as a bare `image` data URL or a single untimed `extraMedia`; `migrateExtraMedia()` handles both. If you change a persisted shape, migrate the old one.

## Pull requests

- One topic per PR.
- Commit subjects follow the existing style: `feat: …`, `fix: …`, imperative, lower case, no trailing period (`git log --oneline` for the flavour).
- UI changes: attach a screenshot or a short clip, and say whether you checked it at phone width, since the layout is tested down to ~380px.
- Say in the PR body what you tested by hand, on top of the e2e test.
- Touching persistence, sync or the player tick? Mention it explicitly so it gets a closer look.

## Things to keep in mind

- **Don't commit secrets.** `.env*` is gitignored except `.env.example`; keep API keys, SMTP credentials and deploy keys out of tracked files and out of PR descriptions.
- **No media downloading.** multi-looper plays YouTube through the official IFrame player and local files you already own. PRs that rip, cache or re-host YouTube audio/video won't be merged: they break YouTube's terms and put the project at risk.
- **Accessibility and keyboard first.** The transport is a keyboard instrument (see the ⌨ panel). New controls get a shortcut where it makes sense, a `title`, and a sane focus order.
- **Performance on phones matters** more than on desktop: this runs next to an instrument, often on an old Android.

## Reporting bugs and features

Open a GitHub issue with: what you did, what you expected, what happened, browser + OS, and whether the track was YouTube, a local file or a mic recording. A failing e2e test is the best bug report there is.

**Security issues**: do not open a public issue. Email <ancelin.maxime@gmail.com> with the details and give it a few days before disclosing.
