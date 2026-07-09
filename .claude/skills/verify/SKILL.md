---
name: verify
description: How to run and drive multi-looper to verify changes at the browser surface.
---

# Verifying multi-looper changes

Surface is the browser at http://localhost:3000. Drive it with Playwright.

## Launch

- Dev server is often already running (check `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`). If not: `bun dev` in the background.
- Auth/sync flows need PocketBase: `docker compose up -d`, then `curl http://127.0.0.1:8090/api/health`. `.env` must have `NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090` (`just env`).

## Drive

Write a throwaway spec as `e2e/<name>.tmp.spec.ts` (testDir is `./e2e`; Playwright's webServer reuses a running dev server) and run just it:

```bash
bunx playwright test e2e/<name>.tmp.spec.ts
```

Delete the spec and `test-results/` afterwards. Standalone Playwright scripts must live inside the repo (node resolves `@playwright/test` from the script's path, not cwd).

## Gotchas

- Reuse helpers from `e2e/app.spec.ts`: `makeWav` (e2e/wav.ts) + `setInputFiles` to add a local file track; block YouTube routes for YT tracks.
- Wait for decode with `expect(page.getByTestId("loop-b")).toHaveValue(...)` before interacting.
- Auth modal: the TopBar `Sign in` button opens it **in signup mode** ("Create your account"); there is no "Create one" toggle in that state. Buttons named "Sign in" are ambiguous (TopBar + modal) — use `.last()`.
- Import modal appears after sign-in only when guest tracks exist.
- Signed-in state shows a `SYNCED` chip; clicking it opens the account menu with "Sign out".
- Test runs leave PB users/records behind in the local docker volume; harmless.
