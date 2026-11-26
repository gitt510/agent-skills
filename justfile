set shell := ["bash", "-cu"]

_default:
    @just --list --unsorted

# Check every skill manifest; extra flags pass through
test *args:
    @bun test {{ args }}

# Lint the TypeScript sources; extra flags pass through
lint *args:
    @bun run --silent lint {{ args }}

# Validate the Claude Code plugin manifest
validate-plugins *args:
    @claude plugin validate . --strict {{ args }}

# Rebuild CHANGELOG.md from Conventional Commit history
build-changelog *args:
    @bunx git-cliff -o CHANGELOG.md {{ args }}
