# multi-looper tasks — run `just` to list

# Android builds need JDK 17+; prefer a ~/.jdks install over a possibly stale shell JAVA_HOME
export JAVA_HOME := `ls -d ~/.jdks/jdk-21* 2>/dev/null | head -1 || echo "${JAVA_HOME:-}"`

default:
    @just --list

# PocketBase (docker) + dev server at http://localhost:3000
dev: pb-up
    bun dev

# Install dependencies
install:
    bun install

# Production build
build:
    bun run build

# Serve the production build
start:
    bun run start

# ESLint
lint:
    bun run lint

# Typecheck (no emit)
check:
    npx tsc --noEmit

# Playwright e2e suite (starts dev server itself)
e2e *args:
    bunx playwright test {{args}}

# Single e2e test by title, e.g. `just e2e-one "play advances"`
e2e-one pattern:
    bunx playwright test -g "{{pattern}}"

# Lint + typecheck + e2e
ci: lint check e2e

# Build web assets and sync them into the Android project
android-sync:
    bun run build
    bunx cap sync android

# Debug APK → android/app/build/outputs/apk/debug/app-debug.apk
android-apk: android-sync
    cd android && ./gradlew assembleDebug

# Build + install + launch on connected device/emulator
android-run: android-sync
    bunx cap run android

# Open the Android project in Android Studio
android-open:
    bunx cap open android

# Start PocketBase (auth + sync backend, optional)
pb-up:
    docker compose up -d

# Stop PocketBase
pb-down:
    docker compose down

# PocketBase logs
pb-logs:
    docker compose logs -f pocketbase

# Create/refresh the .env from the example
env:
    cp -n .env.example .env || true
