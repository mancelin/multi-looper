# Project & Commands

Dark, DAW-style web app for practicing along to music by looping A/B sections of a track (YouTube link, TIDAL track link, or local audio/video file), optionally slowed down. Single-page client app — everything under `src/` is `"use client"`; there is no server code besides the optional PocketBase backend.

A `justfile` wraps all tasks (`just` lists recipes):

```bash
just install    # bun install
just dev        # dev server at http://localhost:3000
just build      # production build
just lint       # eslint
just check      # typecheck (npx tsc --noEmit)
just e2e        # Playwright e2e (e2e/; starts bun dev itself)
just e2e-one "play advances"   # single test by title
just ci         # lint + check + e2e
just pb-up      # PocketBase at http://127.0.0.1:8090 (optional; app works without it)
just env        # cp .env.example .env (NEXT_PUBLIC_POCKETBASE_URL)
just android-apk   # debug APK via Capacitor (android/app/build/outputs/apk/debug/)
just android-run   # build + install + launch on connected device/emulator
```

Stack: Next.js app router + TypeScript, Tailwind CSS v4, Zustand, PocketBase (auth + library sync, optional).

Android: Capacitor wraps the static export (`output: "export"` → `out/`, see `capacitor.config.ts`); native project lives in `android/`. Web changes need `just android-sync` (or `-apk`/`-run`, which include it) to reach the native app. Requires JDK 17+ (justfile picks up `~/.jdks/jdk-21*`) and the Android SDK at `~/Android/Sdk`.
