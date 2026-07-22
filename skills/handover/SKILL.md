---
name: handover
description:
  タスク/トピック単位の進捗を `HANDOVER.md` に集約記録する。「handover
  更新して」「進捗記録して」「タスク引継ぎまとめて」と言われたときに使う。
---

# Handover

Goal: Record task/topic progress in a structured format that allows resuming
work across multiple sessions and contexts.

The primary reader is the **AI in the next session**, not a human. Optimize
for action: classify information by role (constraint / decision / state /
task / reference), not by narrative. Markdown body with XML tags for section
boundaries — tags make scope explicit; md keeps tables/code/lists cheap.

## Output path

Save to the **project root** as `HANDOVER.md`:

```
HANDOVER.md
```

- Single file at the project root (no subdirectory, no slug)
- One file per project; overwrite/update in place

## File format

```markdown
---
title: <task/topic title>
updated: YYYY-MM-DD
status: <one-line: where we are + what remains>
sot: <paths to canonical sources this handover points at>
---

<constraints>

Rules that hold regardless of the task. Violating one breaks the system or
the SoT. State each as an imperative with the failure mode.

</constraints>

<decisions>

Settled. Do not relitigate. Record the rationale with each decision so the
next session does not reopen it.

</decisions>

<state>

What is done and verified (committed, tested, deployed). Facts only.

</state>

<tasks>

Each task is independently actionable and includes its completion check.

<task id="<slug>" priority="1">
What to do, with enough context to start without rereading the file.
constraint: <pointer into constraints, if the task is near a landmine>
verify: <observable condition that means done>
</task>

<task id="<slug>" priority="2" optional="true">
...
</task>

</tasks>

<reference>

Plain facts: tables, commands, paths, device/env identifiers, links to
issues/ADRs (`../issues/`, `../adr/`). Use md tables and code blocks here.

</reference>
```

Section rules:

- Omit a section if empty (e.g. no `<constraints>` yet) — do not leave
  placeholder text.
- Add `<blockers>` between state and tasks when something is stuck on an
  external dependency.
- Importance is expressed by section membership, not decoration: no bold
  for emphasis, no 🔥-style markers. If everything is bold, nothing is.
- Tasks replace checkbox lists: `verify` is the checkbox.
- Tags are delimiters for the model, not validated XML — no escaping
  needed; md syntax stays as-is inside them.

## Workflow

### 0) Preconditions

- Must be inside a project directory.

### 1) Gather context

Review the conversation and existing handover file (if present), then
classify each piece of information by role:

- constraint — must always hold; breaking it damages the system
- decision — settled choice with rationale
- state — done and verified
- task — remaining work, each with a verify condition
- reference — plain facts (paths, commands, tables, issue/ADR links)

A "learning" from the session is usually a constraint (if it guards future
action) or a decision (if it closed an alternative) — file it there, not in
a narrative section.

### 2) Draft handover

Create or update `HANDOVER.md`:

- If file exists: re-sort content into the role sections; move completed
  tasks into state, drop narrative that does not change future action
- If new file: create with the format above
- Update frontmatter `updated` to today and `status` to the current one-liner

### 3) Save file

Save as `HANDOVER.md` at the project root.

## Rules

### Required

- Save to `HANDOVER.md` at project root (invariant path)
- One file per project (do not split)
- Every piece of content lives in exactly one role section
- Every task has a `verify` condition
- Keep language consistent with conversation context (日本語 or English)

### Prohibited

- Do NOT include secrets, tokens, passwords, or sensitive credentials
- Do NOT record work that wasn't actually done
- Do NOT treat handover as the single source of truth (SoT remains in issue/ADR)
- Do NOT delete all existing context without tracking/migration path

### Related to SoT

- Handover is for **continuity**, not as the canonical source of truth
- Link to related issues/ADRs for authoritative requirements and decisions
- Use relative paths for cross-references: `../issues/`, `../adr/`

## Trigger hints (JP/EN)

- JP: `handover 更新して`
- JP: `進捗記録して`
- JP: `タスク引継ぎまとめて`
- JP: `HANDOVER.md に保存して`
- EN: `update handover`
- EN: `record progress`
- EN: `save task handover`
- EN: `save to HANDOVER.md`
