---
name: create-issue
description: >-
  Conventional Commits prefix + flat skeleton (Problem / Impact / Notes?) で
  GitHub issue を起票する (`gh issue create`)。create only — edit / close /
  status lifecycle は持たない。「issue 作って」「issue 起票」「github issue
  作って」「gh issue 作って」「リモートに issue 立てて」、英語なら "create issue"
  / "file an issue" / "gh issue create" と言われたときに使う。
---

# Create Issue

Goal: File a GitHub issue with a Conventional Commits prefixed title and a fixed
English skeleton focused on **why** the work is worth doing. Follow-up sections
(What / Acceptance / Plan) are intentionally deferred to the moment work
actually starts, not filing time.

This skill is **create-only**. Edits and closures are out of scope; use
`gh issue edit` / `gh issue close` for those.

## Title format

`<type>: <concise summary>`

`<type>` is a Conventional Commits prefix:

| prefix     | when to use                                                |
| ---------- | ---------------------------------------------------------- |
| `feat`     | new user-facing capability                                 |
| `fix`      | bug / incorrect behavior                                   |
| `refactor` | internal restructure, no behavior change                   |
| `perf`     | measurable performance improvement                         |
| `chore`    | maintenance, deps, tooling without behavior change         |
| `docs`     | documentation only                                         |
| `test`     | tests only                                                 |
| `build`    | build system, Dockerfile, packaging                        |
| `ci`       | CI config / pipelines                                      |

When two prefixes fit (e.g., Dockerfile optimization → `perf` vs `build`),
pick by the **primary motivation**: `perf` if the goal is speed/size,
`build` if it's reorganizing the build itself.

Propose the title to the user and wait for confirmation before creating.

## Body skeleton (English headers, fixed, flat)

```markdown
## Problem

<Observable fact about the current state that is not good.>

## Impact

<Who or what suffers because of the Problem, and how.>

<!-- Optional section below. Omit it entirely when it has nothing to say; do not pad. -->

## Notes

<Dependencies, prerequisites, see-also, links. Anything that's neither motivation nor a decided plan.>
```

- **Problem** (required) — A concrete, observable fact. Prefer measurements
  ("image size 1.2GB, pull takes 90s") over feelings ("too big").
- **Impact** (required) — Who or what is hurt and how.
- **Notes** (optional) — Dependencies, prerequisites, related issues, or
  short pointers that help the next reader pick this up. Omit when empty.

Other sections (What, Acceptance criteria, Plan) are not part of this
skeleton on purpose. They get decided when work begins, not at filing time.

## Workflow

### 0) Preconditions

`gh repo view` and `gh auth status` must both succeed. Surface errors and stop
on failure.

### 1) Hear the topic

Extract from the user:
- Rough subject (one sentence)
- Whether there are dependencies / prerequisites / related links (for the optional Notes)

### 2) Propose prefix and title

Pick the closest Conventional Commits type and propose the full title.
Wait for the user to confirm or adjust before continuing.

### 3) Duplicate check

```bash
gh issue list --search "<keywords>" --state all --limit 10
```

Present plausible matches with number, title, and state. Ask whether to
continue. Advisory only — user decides.

### 4) Fill Problem and Impact

Ask the user to describe:
- **Problem** in one or two sentences
- **Impact** in one or two sentences
- **Notes** only if the user volunteers dependencies or pointers; never push for them

Never invent facts. If the user is vague, ask one clarifying question
(e.g., "any number you can attach to that?") before writing.

### 5) Preview and confirm

Show the assembled title and body in full. Loop until approved.

### 6) Create

```bash
gh issue create --title "<title>" --body "<body>" --assignee @me
```

Always self-assign with `--assignee @me` (`@me` resolves to the authenticated
`gh` user, so no username is hardcoded). Do not pass `--label`, `--milestone`,
or `--project` — those stay out of scope (see Rules).

### 7) Report result

issue URL, number, title, action: created

## Rules

- **One skeleton, always.** Ignore `.github/ISSUE_TEMPLATE/` even when
  present. The skeleton above is the single source of truth.
- **Self-assign.** Always create issues with `--assignee @me`.
- **No label / milestone / project / priority / severity / estimate.**
  Deliberately out of scope while operations remain informal. If the user
  explicitly asks, do it on request only; never volunteer.
- **English headers, free-form content language.** `## Problem`, `## Impact`,
  `## Notes` stay in English so the structure is searchable;
  prose inside can be Japanese or English.
- **Conventional Commits prefix is required.** Never a bare title.
- **No invented facts.** If the user did not give a number, do not write
  one. Ask or stay qualitative.
- **Duplicate check is advisory.** Present, do not block.
- **Create only.** For edits or closures, use `gh issue edit` /
  `gh issue close`.
