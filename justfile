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

# Build with the production PB URL and rsync the export to the VPS (frontend only)
deploy:
    NEXT_PUBLIC_POCKETBASE_URL=https://pb.multi-looper.com bun run build
    rsync -av --delete out/ $DEPLOY_HOST:/var/www/multi-looper/

# Push, then pull + rebuild PocketBase on the VPS (pending migrations run on boot)
pb-deploy:
    git push
    ssh $DEPLOY_HOST 'cd ~/multi-looper && git pull --ff-only && docker compose up -d --build'
    @echo "waiting for PocketBase…"
    @for i in $(seq 30); do curl -sf https://pb.multi-looper.com/api/health >/dev/null && exit 0; sleep 2; done; echo "PocketBase never came back healthy"; exit 1
    @test "$(ls pb/pb_migrations | sort | md5sum)" = "$(ssh $DEPLOY_HOST 'ls ~/multi-looper/pb/pb_migrations | sort | md5sum')" || { echo "VPS migrations differ from local — the frontend was NOT deployed"; exit 1; }
    @echo "PocketBase up to date"

# Full release: migrate PocketBase first, then ship the frontend (a frontend expecting new PB fields breaks against an un-migrated server)
deploy-and-migrate: pb-deploy deploy
    @echo "deployed: https://multi-looper.com"
