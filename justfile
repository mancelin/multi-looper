# multi-looper tasks — run `just` to list

default:
    @just --list

# Install dependencies
install:
    bun install

# Dev server at http://localhost:3000
dev:
    bun dev

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
