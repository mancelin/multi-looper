# multi-looper tasks: run `just` to list

# .env supplies DEPLOY_HOST for the deploy recipes (see .env.example)
set dotenv-load := true

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

# Build web assets and sync them into the Android project.
# The PB URL is pinned to production: .env points at 127.0.0.1, which on a
# phone is the phone itself.
android-sync:
    NEXT_PUBLIC_POCKETBASE_URL=https://pb.multi-looper.com bun run build
    bunx cap sync android

# Debug APK → android/app/build/outputs/apk/debug/app-debug.apk
android-apk: android-sync
    cd android && ./gradlew assembleDebug

# One-time: create the release keystore and android/keystore.properties.
# The keystore lives outside the repo so `git clean` can't take it. Back it up:
# losing it means Play won't accept updates signed with a new key (unless
# Play App Signing is on, where this is only the resettable upload key).
android-keystore:
    #!/usr/bin/env bash
    set -euo pipefail

    props=android/keystore.properties
    [ ! -e "$props" ] || { echo "$props already exists, nothing changed" >&2; exit 1; }

    store="$HOME/.android-keystores/multi-looper-release.jks"
    [ ! -e "$store" ] || { echo "$store already exists; write $props by hand to point at it" >&2; exit 1; }
    mkdir -p "$(dirname "$store")"

    read -rsp "Keystore password (6+ chars): " pass; echo
    read -rsp "Repeat: " pass2; echo
    [ "$pass" = "$pass2" ] || { echo "passwords differ" >&2; exit 1; }
    [ ${#pass} -ge 6 ] || { echo "password too short" >&2; exit 1; }

    # PKCS12 keystores use one password for the store and the key
    KS_PASS="$pass" keytool -genkeypair -v -keystore "$store" -alias release \
        -keyalg RSA -keysize 4096 -validity 10000 \
        -storepass:env KS_PASS -keypass:env KS_PASS

    umask 077
    printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=release\nkeyPassword=%s\n' \
        "$store" "$pass" "$pass" > "$props"
    echo "keystore   $store"
    echo "properties $props (gitignored)"

# Signed release bundle for Play → android/app/build/outputs/bundle/release/app-release.aab
android-bundle:
    @test -f android/keystore.properties || { echo "android/keystore.properties missing. Run: just android-keystore"; exit 1; }
    just android-sync
    cd android && ./gradlew bundleRelease
    @echo "→ android/app/build/outputs/bundle/release/app-release.aab"

# Build + install + launch on connected device/emulator
android-run: android-sync
    bunx cap run android

# Open the Android project in Android Studio
android-open:
    bunx cap open android

# Start PocketBase (auth + sync backend).
# Port 8090 is exclusive: any other project's PB container holding it (e.g.
# day-log-pocketbase) is stopped first, otherwise the bind fails.
pb-up:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -n "$(docker ps -q --filter 'name=^multilooper-pocketbase$')" ]; then
        echo "PocketBase already up: http://localhost:8090/_/"
        exit 0
    fi

    for id in $(docker ps -q --filter 'publish=8090'); do
        name=$(docker inspect -f '{{{{ .Name }}' "$id" | sed 's|^/||')
        if [ "$name" != "multilooper-pocketbase" ]; then
            echo "Stopping $name, it owns :8090"
            docker stop "$id" >/dev/null
        fi
    done

    docker compose up -d

    for _ in $(seq 1 40); do
        if curl -sf http://127.0.0.1:8090/api/health >/dev/null; then
            echo "PocketBase up: http://localhost:8090/_/"
            exit 0
        fi
        sleep 0.5
    done
    echo "PocketBase never got healthy. Check: just pb-logs" >&2
    exit 1

# Stop PocketBase
pb-down:
    docker compose down

# PocketBase logs
pb-logs:
    docker compose logs -f pocketbase

# Release version bump: rewrite the version files, commit them, tag it.
# `just set-version 1.3` -> package.json 1.3.0, versionName 1.3, commit "v1.3", tag v1.3.
# The Android versionCode is bumped by 1, because Play refuses an install/upgrade
# that doesn't increment it.
set-version version:
    #!/usr/bin/env bash
    set -euo pipefail

    v="{{version}}"
    [[ "$v" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || { echo "version must look like 1.3 or 1.3.1" >&2; exit 1; }

    # package.json wants a full semver; the Android versionName drops a trailing .0
    pkg="$v"; [[ "$pkg" == *.*.* ]] || pkg="$pkg.0"
    name="${pkg%.0}"

    code=$(sed -n 's/.*versionCode \([0-9]*\).*/\1/p' android/app/build.gradle)
    [ -n "$code" ] || { echo "no versionCode in android/app/build.gradle" >&2; exit 1; }

    # checked before anything is written, so a clash leaves the tree untouched
    tag="v$name"
    if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
        echo "tag $tag already exists, nothing changed" >&2
        exit 1
    fi

    sed -i "s/^\(  \"version\": \).*/\1\"$pkg\",/" package.json
    sed -i "s/versionCode .*/versionCode $((code + 1))/; s/versionName \".*\"/versionName \"$name\"/" android/app/build.gradle

    echo "package.json      $pkg"
    echo "versionName       $name"
    echo "versionCode       $((code + 1))"

    # pathspec commit: only the version files land in it, whatever else is
    # staged or dirty stays untouched in the working tree
    files="package.json android/app/build.gradle"
    if git diff --quiet -- $files && git diff --cached --quiet -- $files; then
        echo "commit            skipped: version files already at $pkg"
    else
        git commit -q -m "$tag" -- $files
        echo "commit            $tag"
    fi

    # tags the version commit itself, so `git show $tag` is the bump
    git tag "$tag"
    echo "tag               $tag -> $(git rev-parse --short HEAD)"

# Create/refresh the .env from the example
env:
    cp -n .env.example .env || true

# Build with the production PB URL and rsync the export to the VPS (frontend only)
deploy: _need-host
    NEXT_PUBLIC_POCKETBASE_URL=https://pb.multi-looper.com bun run build
    rsync -av --delete out/ "$DEPLOY_HOST":/var/www/multi-looper/

# Push, then pull + rebuild PocketBase on the VPS (pending migrations run on boot)
pb-deploy: _need-host
    git push
    ssh "$DEPLOY_HOST" 'cd ~/multi-looper && git pull --ff-only && docker compose up -d --build'
    @echo "waiting for PocketBase…"
    @for i in $(seq 30); do curl -sf https://pb.multi-looper.com/api/health >/dev/null && exit 0; sleep 2; done; echo "PocketBase never came back healthy"; exit 1
    @test "$(ls pb/pb_migrations | sort | md5sum)" = "$(ssh "$DEPLOY_HOST" 'ls ~/multi-looper/pb/pb_migrations | sort | md5sum')" || { echo "VPS migrations differ from local, the frontend was NOT deployed"; exit 1; }
    @echo "PocketBase up to date"

# Guard: the deploy recipes need a target, kept out of the repo
_need-host:
    @test -n "${DEPLOY_HOST:-}" || { echo "DEPLOY_HOST is not set. Add it to .env (see .env.example)"; exit 1; }

# Full release: migrate PocketBase first, then ship the frontend (a frontend expecting new PB fields breaks against an un-migrated server)
deploy-and-migrate: pb-deploy deploy
    @echo "deployed: https://multi-looper.com"
