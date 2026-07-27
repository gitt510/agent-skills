# agent-skills

Personal agent skills for Claude Code, Codex, and other agents that use the Agent Skills format. The included CLI links this repository's skills into local agent skill directories through symlinks.

## Scope and ownership

This CLI is a personal environment reconciler, not a general-purpose package manager. Within a selected target, skill names present in this repository are treated as repository-owned. Therefore, `apply` intentionally replaces same-name symlinks that point elsewhere and removes all dangling symlinks, including links not created by this repository. Run `plan` or `scan` first if the target directory also contains symlinks managed by hand or by another tool.

The repository is published as a portfolio and reference; the author remains its primary user. Skill instructions are written in Japanese or English and may encode opinionated workflows, but should not depend on personal identifiers or fixed device configuration.

macOS is the assumed operating environment. Some skills also work on Linux, but cross-platform compatibility is not a project goal unless a skill explicitly says otherwise.

## Requirements

- Git
- Bun 1.3.14 (version used in CI)
- Just

Some skills have additional runtime requirements:

- GitHub workflows: authenticated `gh`; `oss-bus-factor` also requires `jq` and network access
- `add-google-task`: authenticated `gog` and network access
- `holy-grail-html`: a desktop browser plus the `frontend-design` and `modern-web-guidance` agent skills
- `mouse-doctor`: LinearMouse or Karabiner-Elements
- `tmux`: `tmux` and an existing tmux session
- `yt-digest`: Python 3, `uvx`, Node.js, and network access

## Quickstart

Clone the repository, preview the changes for one target, apply them, and verify the result:

```bash
git clone https://github.com/gitt510/agent-skills.git
cd agent-skills
just plan --target codex
just apply --target codex
just doctor --target codex
```

Replace `codex` with `agents` or `claude` as needed. Omitting `--target` processes all three target directories.

## Targets

| Target | Skills directory |
| --- | --- |
| `agents` | `~/.config/agents/skills/` |
| `claude` | `~/.claude/skills/` |
| `codex` | `~/.codex/skills/` |

## Skills

Run `just list` to see every repository skill together with its installation status in each target. The source and detailed behavior of each skill live under [`skills/`](skills/).

## Commands

```bash
just <doctor|list|scan|plan|apply> [--target <agents|claude|codex>]
```

| Command | Behavior |
| --- | --- |
| `just doctor` | Reports target health and exits non-zero while a repository skill is missing, a dangling symlink remains, or an installed skill has no `SKILL.md` |
| `just list` | Shows each repository skill's status across the selected targets |
| `just scan` | Lists everything installed in each target, including external skills, with status and symlink target |
| `just plan` | Previews every action `apply` would take without changing anything, and exits non-zero when a non-symlink entry blocks `apply` |
| `just apply` | Reconciles repository skills after checking every selected target for real-file and real-directory conflicts |

Every command accepts `--target <target>` (short form `-t`) to limit the run to one destination and `--help` to print usage.

## Apply impact

- `apply` creates absolute symlinks for missing repository skills
- `apply` replaces symlinks with repository skill names when they point somewhere else
- `apply` deletes every dangling symlink in the selected skills directories, including symlinks not created by this repository
- `apply` leaves valid external skills with other names unchanged
- `apply` never links a repository directory that has no `SKILL.md`, and leaves any such link already in place untouched
- `apply` makes no changes when a repository skill destination is occupied by a real file or directory

## Update, removal, and relocation

Update the clone, reconcile newly added or removed skills, and check the result:

```bash
git pull --ff-only
just plan --target codex
just apply --target codex
just doctor --target codex
```

To remove a managed link from one target, use `just list` to confirm that its destination is `MANAGED`, then unlink that destination. Do not recursively delete the target directory:

```bash
unlink ~/.codex/skills/<skill-name>
```

This is not a persistent exclusion: a later `just apply` restores the link while the skill remains in this repository.

The CLI creates absolute symlinks. After moving the repository clone, run `just plan` from the new location to review the stale destinations, then run `just apply` for each target that should follow the new path.

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
- `src/cli.ts` provides the reconciliation and inspection CLI
- `src/cli.test.ts` covers CLI behavior with isolated temporary home directories

## Development

```bash
just test
git ls-files -z '*.sh' | xargs -0 shellcheck
git ls-files -z '*.py' | xargs -0 -n1 python3 -m py_compile
```

## License

- Repository content is available under the [MIT License](LICENSE)
- `skills/ponytail-review` retains the upstream copyright and MIT terms in its [nested license](skills/ponytail-review/LICENSE)
