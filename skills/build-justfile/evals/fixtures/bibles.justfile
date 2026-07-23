_default:
    @just --list --list-submodules

# ── env ─────────────────────────────────────────────────────────────────

# Materialize .env from .env.refs using 1Password (Touch ID once)
[group('env')]
env-init:
    op inject -i .env.refs -o .env
    @printf "→ .env materialized (%s bytes)\n" "$(wc -c < .env | tr -d ' ')"

# ── db ──────────────────────────────────────────────────────────────────

# Apply drizzle migrations to the Neon database
[group('db')]
db-migrate:
    pnpm db:migrate

# Generate a new drizzle migration from schema diff
[group('db')]
db-generate:
    pnpm db:generate

# ── dev ─────────────────────────────────────────────────────────────────

# Start API + web dev servers
[group('dev')]
dev:
    pnpm dev

# Add an entry via the API: just bible-add <url> --title <s> --description <s>
[group('dev')]
bible-add *ARGS:
    pnpm bible:add {{ARGS}}
