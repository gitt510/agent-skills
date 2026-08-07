set shell := ["bash", "-cu"]

_default:
    @just --list --unsorted

# Show each repo skill's status across targets
[group('skills')]
list *args:
    @bun run --silent agent-skills list {{ args }}

# List everything installed per target, including external skills
[group('skills')]
scan *args:
    @bun run --silent agent-skills scan {{ args }}

# Show a compact health summary and blocking details
[group('skills')]
doctor *args:
    @bun run --silent agent-skills doctor {{ args }}

# Preview what apply would change
[group('skills')]
plan *args:
    @bun run --silent agent-skills plan {{ args }}

# Reconcile repo skills in supported agent skill directories
[group('skills')]
apply *args:
    @bun run --silent agent-skills apply {{ args }}

# Run the CLI test suite; extra flags pass through
[group('dev')]
test *args:
    @bun test {{ args }}

# Lint the TypeScript sources; extra flags pass through
[group('dev')]
lint *args:
    @bun run --silent lint {{ args }}

# Validate the Claude Code plugin manifest
[group('dev')]
validate-plugins *args:
    @claude plugin validate . --strict {{ args }}

# Rebuild CHANGELOG.md from Conventional Commit history
[group('dev')]
build-changelog *args:
    @bunx git-cliff -o CHANGELOG.md {{ args }}
