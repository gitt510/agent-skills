# agent-skills

- This repository holds personal agent skills in the Agent Skills format
- Claude Code loads the skills as a plugin
- The repository is published as a portfolio and reference, and the author remains its primary user
- Skill instructions are written in Japanese or English and may encode opinionated workflows
- Skill instructions do not depend on personal identifiers or fixed device configuration
- macOS is the assumed operating environment, and a skill supports another platform only where it says so

## Install

```
/plugin marketplace add gitt510/agent-skills
/plugin install gitt510-skills@gitt510-skills
```

- `.claude-plugin/marketplace.json` marks the repository as a plugin marketplace whose single plugin serves every skill under `skills/`
- Installed skills are namespaced as `gitt510-skills:<skill-name>`
- No version is pinned, so each commit on `main` is a new plugin version

## Update

```
/plugin marketplace update gitt510-skills
/plugin update
```

## Skills

- Each skill lives at [`skills/<name>/SKILL.md`](skills/), with its description in the frontmatter

| Skill | Runtime requirement |
| --- | --- |
| `create-issue`, `create-pr`, `create-repo` | Authenticated `gh` |
| `oss-bus-factor` | Authenticated `gh`, `jq`, network access |
| `dads` | Authenticated `gh`, network access |
| `mouse-doctor` | LinearMouse or Karabiner-Elements |
| `tmux` | `tmux`, an existing tmux session |

## Development

- Development needs Git, Bun 1.3.14 (the version used in CI), and Just

```bash
just test
just lint
just validate-plugins
git ls-files -z '*.sh' | xargs -0 shellcheck
git ls-files -z '*.py' | xargs -0 -n1 python3 -m py_compile
```

| Command | Behavior |
| --- | --- |
| `just test` | Asserts that every directory under `skills/` has a valid `SKILL.md` manifest |
| `just lint` | Lints the TypeScript sources |
| `just validate-plugins` | Runs `claude plugin validate . --strict` against the manifest |
| `just build-changelog` | Rebuilds `CHANGELOG.md` from Conventional Commit history |

## License

- Repository content is available under the [MIT License](LICENSE)
- `skills/ponytail-review` retains the upstream copyright and MIT terms in its [nested license](skills/ponytail-review/LICENSE)
- `skills/dads/references` bundles Digital Agency Design System files under their own terms, recorded in its [notice](skills/dads/references/NOTICE.md)
