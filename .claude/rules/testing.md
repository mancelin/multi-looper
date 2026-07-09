# Testing

Every new feature gets a Playwright e2e test in `e2e/` covering its main user-visible flow (plus the interesting failure path when there is one). Reuse the helpers in `e2e/app.spec.ts` / `e2e/wav.ts`. The suite must stay runnable offline without PocketBase: tests that need PB (auth, sync) must probe `http://127.0.0.1:8090/api/health` and `test.skip()` when it is unreachable.
