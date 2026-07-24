# agent-skills

Personal agent skills for Claude Code, Codex, and other agents that use the Agent Skills format. The included CLI distributes this repository's skills through local symlinks.

## Scope and ownership

This CLI is a personal environment reconciler, not a general-purpose package manager. Within a selected target, skill names present in this repository are treated as repository-owned. Therefore, `distribute` intentionally replaces same-name symlinks that point elsewhere and removes all dangling symlinks, including links not created by this repository. Run `list` first if the target directory also contains symlinks managed by hand or by another tool.

## Requirements

- Git clones the repository
- Bun runs the CLI and test suite
- Just provides optional command shortcuts

## Targets

| Target | Skills directory |
| --- | --- |
| `agents` | `~/.config/agents/skills/` |
| `claude` | `~/.claude/skills/` |
| `codex` | `~/.codex/skills/` |

## Commands

```bash
bun run --silent agent-skills <doctor|list|distribute> [agents|claude|codex]
```

| Command | Behavior |
| --- | --- |
| `doctor` | Reports target health and exits non-zero while a repository skill is missing, a dangling symlink remains, or an installed skill has no `SKILL.md` |
| `list` | Lists repository and external skills with their status and symlink target |
| `distribute` | Reconciles repository skills after checking every selected target for real-file and real-directory conflicts |

```bash
just doctor
just list codex
just distribute claude
```

## Distribution impact

- `distribute` creates absolute symlinks for missing repository skills
- `distribute` replaces symlinks with repository skill names when they point somewhere else
- `distribute` deletes every dangling symlink in the selected skills directories, including symlinks not created by this repository
- `distribute` leaves valid external skills with other names unchanged
- `distribute` never links a repository directory that has no `SKILL.md`, and leaves any such link already in place untouched
- `distribute` makes no changes when a repository skill destination is occupied by a real file or directory

## Statuses

| Status | Meaning |
| --- | --- |
| `MANAGED` | The destination resolves to this repository's skill and that skill has a `SKILL.md` |
| `INCOMPLETE` | The name belongs to this repository but its directory has no `SKILL.md`; counted only once a symlink to it is installed |
| `MISSING` | This repository contains the skill but the expected destination does not resolve to it |
| `STALE` | The destination is a symlink whose target does not exist |
| `EXTERNAL` | The destination is a valid entry whose name this repository does not own |

## Repository layout

- `skills/<name>/SKILL.md` is the entry point for each skill
- `src/cli.ts` provides the distribution and inspection CLI
- `src/cli.test.ts` covers CLI behavior with isolated temporary home directories

## Development

```bash
bun test
shellcheck skills/oss-bus-factor/scripts/measure.sh skills/tmux/scripts/wait-for-text.sh
```

## License

- Repository content is available under the [MIT License](LICENSE)
- `skills/ponytail-review` retains the upstream copyright and MIT terms in its [nested license](skills/ponytail-review/LICENSE)
