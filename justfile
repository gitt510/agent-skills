set shell := ["bash", "-cu"]

_default:
    @just --list --unsorted

# Show each repo skill's status across targets
list *args:
    @bun run --silent agent-skills list {{ args }}

# List everything installed per target, including external skills
scan *args:
    @bun run --silent agent-skills scan {{ args }}

# Show a compact health summary and blocking details
doctor *args:
    @bun run --silent agent-skills doctor {{ args }}

# Preview what apply would change
plan *args:
    @bun run --silent agent-skills plan {{ args }}

# Reconcile repo skills in supported agent skill directories
apply *args:
    @bun run --silent agent-skills apply {{ args }}

# Run the CLI test suite; extra flags pass through
test *args:
    @bun test {{ args }}

# Regenerate CHANGELOG.md from Conventional Commit history
changelog *args:
    @bunx git-cliff -o CHANGELOG.md {{ args }}
