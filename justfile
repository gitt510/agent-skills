set shell := ["bash", "-cu"]

_default:
    @just --list --unsorted

# Show each repo skill's status across targets
list target="":
    @bun run --silent agent-skills list {{ quote(target) }}

# List everything installed per target, including external skills
scan target="":
    @bun run --silent agent-skills scan {{ quote(target) }}

# Show a compact health summary and blocking details
doctor target="":
    @bun run --silent agent-skills doctor {{ quote(target) }}

# Preview what apply would change
plan target="":
    @bun run --silent agent-skills plan {{ quote(target) }}

# Reconcile repo skills in supported agent skill directories
apply target="":
    @bun run --silent agent-skills apply {{ quote(target) }}

# Run the CLI test suite; extra flags pass through
test *args:
    @bun test {{ args }}

# Regenerate CHANGELOG.md from Conventional Commit history
changelog:
    @bunx git-cliff -o CHANGELOG.md
