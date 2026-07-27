---
name: add-google-task
description: >
  Add a single task to the default Google Tasks list with gog tasks add. Derives the
  title, due date, and notes from conversation context instead of interrogating the
  user, confirms a human-readable summary before writing, and never encodes account or
  list identifiers. Add-only — no list, update, complete, or delete. Use when the user
  asks to put something on their tasks or todo list, e.g. "add X to tomorrow's tasks",
  「X を明日の task に追加しておいて」.
---

# Add Google Task

Goal: add one task to the **default account's default task list** via `gog tasks add`,
deriving the content from conversation context and confirming a summary before the
write.

This skill is **add-only**. Listing, editing, completing, and deleting tasks are out
of scope; use `gog tasks` subcommands directly for those.

## Identity stays out of the repo

- The task list argument is always `@default`, and `-a` / `--account` is never passed.
- "Whose tasks" is resolved by the machine-local gog state (Keychain). The same skill
  writes to whatever account is default on the machine it runs on — identity and
  logic stay separated.
- Never hardcode an email address, list name, or list ID.

## Workflow

### 0) Preconditions

`command -v gog` and `gog auth status` must both succeed. If gog is missing or
unauthenticated, point the user to the setup path and stop:

```bash
gog auth credentials   # one-time client setup
gog auth add           # add an account
```

### 1) Derive the task from context (don't interrogate)

The trigger is typically terse — "ok, add X to tomorrow's tasks". Build the task from
the current conversation instead of asking field by field:

- **title** (required) — rewrite the subject as a concise, self-contained task line,
  not a verbatim quote of the utterance.
- **due** (optional) — resolve relative expressions (明日, Friday, next week) against
  the system clock to `YYYY-MM-DD`. Google Tasks ignores the time-of-day part, so
  round to a date; when a specific time matters, carry it into notes.
- **notes** (optional) — maps to the "詳細" / Details field in the Google Tasks UI.
  Summarize supporting context: relevant URLs, why the task exists, decisions already
  made. Leave it empty when there is nothing to say; never pad.

Ask the user only when even a title cannot be derived. Everything else: guess, then
show it in step 2.

### 2) Confirm the summary (the single gate)

Present the task content — not the command — and loop on feedback until approved:

```
📋 Adding:
  Title: <title>
  Due:   2026-07-28 (明日)
  Notes: <notes, or omit the line>
```

Show resolved dates together with the original relative expression. Because step 1 is
inference, this confirmation is mandatory even when the request seems unambiguous.

### 3) Execute

```bash
gog tasks add @default --title "<title>" [--notes "<notes>"] [--due YYYY-MM-DD] --json --no-input
```

Parse the JSON result and close with a single line: what was added plus the task's
`webViewLink`. There is no separate report step.

## Rules

- **Derive, don't interrogate.** No field-by-field questioning; wrong guesses are
  caught at the summary gate, not prevented by interviews.
- **One confirmation, always.** Step 2 is never skipped.
- **`@default` only, no `-a`.** A different list is used only when the user names one
  explicitly, and only for that invocation — it never becomes a default.
- **`--json --no-input` on every call.**
- **Dates resolve against the system clock**, and the summary shows both the resolved
  date and the original expression.
- **Only title / notes / due.** `--parent`, `--previous`, and the repeat flags are out
  of scope; extend the skill when a real need appears.
- **No invented content.** Notes contain only facts from the conversation; if the
  user gave no date, do not guess one.
