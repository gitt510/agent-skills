# agent-skills

Personal agent skills for Claude Code, Codex, and other agents that use the Agent Skills format. The included CLI distributes this repository's skills through local symlinks.

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
| `doctor` | Reports target health and exits non-zero while a repository skill is missing or a dangling symlink remains |
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
- `distribute` makes no changes when a repository skill destination is occupied by a real file or directory

## Statuses

| Status | Meaning |
| --- | --- |
| `MANAGED` | The destination resolves to this repository's skill |
| `MISSING` | This repository contains the skill but the expected destination does not resolve to it |
| `STALE` | The destination is a symlink whose target does not exist |
| `EXTERNAL` | The destination is a valid entry outside this repository's management |

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
