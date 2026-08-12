# agent-skills

Personal agent skills for Claude Code, Codex, and other agents that use the Agent Skills format. The included CLI links this repository's skills into local agent skill directories through symlinks.

## Scope and ownership

This CLI is a personal environment reconciler, not a general-purpose package manager. Within a selected target, skill names present in this repository are treated as repository-owned. Therefore, `apply` intentionally replaces same-name symlinks that point elsewhere and removes all dangling symlinks, including links not created by this repository. Run `plan` or `scan` first if the target directory also contains symlinks managed by hand or by another tool.

Ownership has one exception: names the installed Claude Code plugin already serves belong to the plugin, not to the symlink layer. See [Division with the `claude` target](#division-with-the-claude-target).

The repository is published as a portfolio and reference; the author remains its primary user. Skill instructions are written in Japanese or English and may encode opinionated workflows, but should not depend on personal identifiers or fixed device configuration.

macOS is the assumed operating environment. Some skills also work on Linux, but cross-platform compatibility is not a project goal unless a skill explicitly says otherwise.

## Requirements

- Git
- Bun 1.3.14 (version used in CI)
- Just
- Claude Code CLI (`claude`), optional: used to read plugin coverage for the `claude` target

Some skills have additional runtime requirements:

- GitHub workflows: authenticated `gh`; `oss-bus-factor` also requires `jq` and network access
- `add-google-task`, `list-google-tasks`: authenticated `gog` and network access
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

| Target | Skills directory | Notes |
| --- | --- | --- |
| `agents` | `~/.config/agents/skills/` | |
| `claude` | `~/.claude/skills/` | Shares the skill set with the Claude Code plugin when it is installed |
| `codex` | `~/.codex/skills/` | |

## Claude Code plugin

The repository is also installable as a Claude Code plugin. `.claude-plugin/marketplace.json` marks the repository as a plugin marketplace whose single plugin serves every skill under `skills/`:

```
/plugin marketplace add gitt510/agent-skills
/plugin install gitt510-skills@gitt510-skills
```

- Installed skills are namespaced as `gitt510-skills:<skill-name>`
- No version is pinned, so each commit on `main` is a new plugin version; users pick up changes with `/plugin marketplace update gitt510-skills` followed by `/plugin update`
- `just validate-plugins` runs `claude plugin validate . --strict` against the manifest

### Division with the `claude` target

The plugin and the `claude` symlink target both feed Claude Code, so the CLI divides the skill set between them instead of letting one skill register twice:

- While the plugin is installed and enabled, the `claude` target owns only the skills the plugin does not serve — typically a skill added locally and not yet pushed
- `apply` links those skills, and removes its own link once the plugin serves that name, so the plugin takes over as the single registration
- A skill the plugin serves is reported `PLUGIN`; if a symlink for it is also installed, that destination is reported `DUPLICATE` and the next `apply` unlinks it
- Coverage comes from `claude plugin list --json` plus the `skills/` directory of the reported install path. No Claude Code CLI on `PATH` means no plugin, so every skill is linked as before
- The plugin serves the commit it was last updated to, not `main`. A pushed skill stays symlinked until `/plugin marketplace update gitt510-skills` and `/plugin update` bring it into the plugin
- When the CLI exists but cannot answer, the `claude` target is reported as blocked and `apply` makes no changes anywhere

To rework a skill the plugin already serves, turn the division off for the duration instead of working around it:

```bash
claude plugin disable gitt510-skills
just apply --target claude    # every skill links under its plain name; edits apply immediately
# rework, test, push, then update the plugin
claude plugin enable gitt510-skills
just apply --target claude    # the served skills unlink again
```

## Skills

Run `just list` to see every repository skill together with its installation status in each target. The source and detailed behavior of each skill live under [`skills/`](skills/).

## Commands

```bash
just <doctor|list|scan|plan|apply> [--target <agents|claude|codex>]
```

| Command | Behavior |
| --- | --- |
| `just doctor` | Reports target health and exits non-zero while a repository skill is missing, a dangling symlink remains, or a skill is registered twice |
| `just list` | Shows each repository skill's status across the selected targets |
| `just scan` | Lists everything installed in each target, including external skills, with status and symlink target |
| `just plan` | Previews every action `apply` would take without changing anything, and exits non-zero when a non-symlink entry or an unreadable plugin state blocks `apply` |
| `just apply` | Reconciles repository skills after checking every selected target for real-file and real-directory conflicts |

Every command accepts `--target <target>` (short form `-t`) to limit the run to one destination and `--help` to print usage.

## Apply impact

- `apply` creates absolute symlinks for missing repository skills
- `apply` replaces symlinks with repository skill names when they point somewhere else
- `apply` deletes every dangling symlink in the selected skills directories, including symlinks not created by this repository
- `apply` leaves valid external skills with other names unchanged
- `apply` never links a directory that has no `SKILL.md`, and leaves any such link already in place untouched
- `apply` makes no changes when a repository skill destination is occupied by a real file or directory
- In the `claude` target, `apply` skips every skill the enabled Claude Code plugin serves, and unlinks its own symlink for such a skill; a destination it did not create is left alone

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

This is not a persistent exclusion: a later `just apply` restores the link while the skill remains in this repository. In the `claude` target the link is not restored while the Claude Code plugin serves that skill.

The CLI creates absolute symlinks. After moving the repository clone, run `just plan` from the new location to review the stale destinations, then run `just apply` for each target that should follow the new path.

## Statuses

Every status describes one destination on two axes: whether the name is ours or the plugin's, and whether our symlink resolves to the source. A directory under `skills/` without a `SKILL.md` cannot load, so it is not a skill: it is never linked and never reported. `just test` asserts that every directory has a valid manifest.

| Status | Meaning |
| --- | --- |
| `MANAGED` | The destination resolves to this repository's skill |
| `MISSING` | This repository contains the skill but the expected destination does not resolve to it |
| `PLUGIN` | The Claude Code plugin serves this skill, so the `claude` target leaves the name to it |
| `DUPLICATE` | The plugin serves this skill and a symlink for it is installed as well; `apply` removes the symlink |
| `STALE` | The destination is a symlink whose target does not exist |
| `EXTERNAL` | The destination is a valid entry whose name this repository does not own, including a plugin-served name occupied by something else |

Colour follows severity, and a count of zero is never a finding: red is broken right now (`DUPLICATE`, `STALE`), yellow is resolved by `apply` (`MISSING`), magenta is `apply` refusing to act, green is steady state (`MANAGED`), cyan is informational (`EXTERNAL`), bright yellow is plugin-managed (`PLUGIN`), and dim is zero.

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
