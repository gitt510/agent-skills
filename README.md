# agent-skills

Personal agent skills for Claude Code, Codex, and other agents that use the Agent Skills format. Claude Code loads them as a plugin; the included CLI links them into the other agents' skill directories through symlinks.

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
- `dads`: authenticated `gh` and network access for fetching component sources and refreshing pinned files
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

Replace `codex` with `agents` as needed. Omitting `--target` processes both target directories.

## Targets

| Target | Skills directory |
| --- | --- |
| `agents` | `~/.config/agents/skills/` |
| `codex` | `~/.codex/skills/` |

Claude Code has no target: it loads the skills through the plugin, and the CLI never touches `~/.claude/skills/`.

## Claude Code plugin

Claude Code installs the skills as a plugin. `.claude-plugin/marketplace.json` marks the repository as a plugin marketplace whose single plugin serves every skill under `skills/`:

```
/plugin marketplace add gitt510/agent-skills
/plugin install gitt510-skills@gitt510-skills
```

- Installed skills are namespaced as `gitt510-skills:<skill-name>`
- No version is pinned, so each commit on `main` is a new plugin version; users pick up changes with `/plugin marketplace update gitt510-skills` followed by `/plugin update`
- `just validate-plugins` runs `claude plugin validate . --strict` against the manifest

## Skills

Run `just list` to see every repository skill with the description from its manifest. The source and detailed behavior of each skill live under [`skills/`](skills/); installation status per target comes from `just scan` and `just doctor`.

## Commands

```bash
just <doctor|list|scan|plan|apply> [--target <agents|codex>]
```

| Command | Behavior |
| --- | --- |
| `just doctor` | Reports target health and exits non-zero while a repository skill is missing or a dangling symlink remains |
| `just list` | Shows each repository skill with the description from its manifest |
| `just scan` | Lists everything installed in each target, including external skills, with status and symlink target |
| `just plan` | Previews every action `apply` would take without changing anything, and exits non-zero when a non-symlink entry blocks `apply` |
| `just apply` | Reconciles repository skills after checking every selected target for real-file and real-directory conflicts |

Every command accepts `--help` to print usage. Every command except `list` accepts `--target <target>` (short form `-t`) to limit the run to one destination; `list` reads only the repository, so it rejects `--target`.

## Apply impact

- `apply` creates absolute symlinks for missing repository skills
- `apply` replaces symlinks with repository skill names when they point somewhere else
- `apply` deletes every dangling symlink in the selected skills directories, including symlinks not created by this repository
- `apply` leaves valid external skills with other names unchanged
- `apply` never links a directory that has no `SKILL.md`, and leaves any such link already in place untouched
- `apply` makes no changes when a repository skill destination is occupied by a real file or directory

## Update, removal, and relocation

Update the clone, reconcile newly added or removed skills, and check the result:

```bash
git pull --ff-only
just plan --target codex
just apply --target codex
just doctor --target codex
```

To remove a managed link from one target, use `just scan` to confirm that its destination is `MANAGED`, then unlink that destination. Do not recursively delete the target directory:

```bash
unlink ~/.codex/skills/<skill-name>
```

This is not a persistent exclusion: a later `just apply` restores the link while the skill remains in this repository.

The CLI creates absolute symlinks. After moving the repository clone, run `just plan` from the new location to review the stale destinations, then run `just apply` for each target that should follow the new path.

## Statuses

Every status describes whether one destination resolves to this repository's skill. A directory under `skills/` without a `SKILL.md` cannot load, so it is not a skill: it is never linked and never reported. `just test` asserts that every directory has a valid manifest.

| Status | Meaning |
| --- | --- |
| `MANAGED` | The destination resolves to this repository's skill |
| `MISSING` | This repository contains the skill but the expected destination does not resolve to it |
| `STALE` | The destination is a symlink whose target does not exist |
| `EXTERNAL` | The destination is a valid entry whose name this repository does not own |

Colour follows severity, and a count of zero is never a finding: red is broken right now (`STALE`), yellow is resolved by `apply` (`MISSING`), magenta is `apply` refusing to act, green is steady state (`MANAGED`), cyan is informational (`EXTERNAL`), and dim is zero.

## Repository layout

- `skills/<name>/SKILL.md` is the entry point for each skill
- `.claude-plugin/marketplace.json` exposes the repository as a Claude Code plugin marketplace
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
- `skills/dads/references` bundles Digital Agency Design System files under their own terms, recorded in its [notice](skills/dads/references/NOTICE.md)
