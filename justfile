set shell := ["bash", "-cu"]

# List available recipes
default:
    @just --list

# Reconcile repo skills in supported agent skill directories
[group('Skills')]
distribute target="":
    @bun run --silent agent-skills distribute {{ quote(target) }}

# Show a compact health summary and blocking details
[group('Skills')]
doctor target="":
    @bun run --silent agent-skills doctor {{ quote(target) }}

# List repo and external skills with status and symlink target
[group('Skills')]
list target="":
    @bun run --silent agent-skills list {{ quote(target) }}

# Run the zero-dependency CLI test suite
[group('Development')]
test:
    @bun test
