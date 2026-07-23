_default:
    @just --list --list-submodules

# ── env ────────────────────────────────────────────────────────────────

# Materialize .env (root) と apps/api/.dev.vars を .env.refs から生成 (Touch ID 1 回)
[group('env')]
env-init:
    op inject -i .env.refs -o .env
    cp .env apps/api/.dev.vars
    @printf "→ .env materialized (%s bytes), .dev.vars copied to apps/api/\n" "$(wc -c < .env | tr -d ' ')"

# ── dev ────────────────────────────────────────────────────────────────

# Start API + web dev servers
[group('dev')]
dev:
    pnpm dev

# API only (http://localhost:3000、docs at /docs)
[group('dev')]
dev-api:
    pnpm dev:api

# Web only (http://localhost:5173)
[group('dev')]
dev-web:
    pnpm dev:web

# Storybook (WordCard layout lab, http://localhost:6006)
[group('dev')]
storybook:
    pnpm --filter @lexicon/web run storybook

# ── db ─────────────────────────────────────────────────────────────────

# Generate a new migration from schema.ts
[group('db')]
db-generate:
    pnpm db:generate

# Apply pending migrations to Neon
[group('db')]
db-migrate:
    pnpm db:migrate

# Open Drizzle Studio (web UI for browsing words table)
[group('db')]
db-studio:
    pnpm db:studio

# Introspect Neon and compare with schema.ts visually
[group('db')]
db-inspect:
    pnpm exec tsx --env-file=.env scripts/inspect.ts

# Drop words + drizzle migration log (destructive — schema 練り直し用)
[group('db')]
db-drop:
    pnpm exec tsx --env-file=.env scripts/drop.ts

# ── content ──────────────────────────────────────────────────────────────

# Rebuild apps/web/public/columns.json from content/columns/*.md
[group('content')]
content-build:
    pnpm exec tsx scripts/build-columns.ts

# ── design ─────────────────────────────────────────────────────────────

# Rebuild design tokens: DESIGN.md → DTCG → Style Dictionary → :root vars
[group('design')]
design-build:
    pnpm --filter @lexicon/design build

# Lint DESIGN.md (structure + WCAG AA contrast on component fg/bg pairs)
[group('design')]
design-lint:
    pnpm --filter @lexicon/design lint

# ── deploy ─────────────────────────────────────────────────────────────

# Deploy API to Cloudflare Workers (DATABASE_URL は事前に `wrangler secret put` で投入済み前提)
# 注: `pnpm deploy` は pnpm の予約コマンドなので script は `run` 経由で呼ぶ
[group('deploy')]
deploy-api:
    pnpm --filter @lexicon/api run deploy

# Build and deploy web to Cloudflare Pages
[group('deploy')]
deploy-web:
    pnpm --filter @lexicon/web run deploy

# Deploy both
[group('deploy')]
deploy: deploy-api deploy-web
