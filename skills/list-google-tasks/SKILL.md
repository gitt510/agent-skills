---
name: list-google-tasks
description: >
  List tasks from the default Google Tasks list with gog tasks list, read-only by
  mechanism (--readonly blocks mutating API calls at runtime). Derives filters — due
  window, completed or not — from conversation context, then presents the tasks
  human-readably and stops; it never completes, edits, or adds anything. Use when the
  user wants to see their tasks or plan around them, e.g. "what's on my tasks today?",
  「google の task みれる？」「今日が期限のもの消化したい」 — even when the eventual goal
  is to work through tasks, fetching them starts here.
---

# List Google Tasks

Goal: fetch tasks from the **default account's default task list** via
`gog tasks list`, filter by what the conversation asks for, and present them. The
skill ends at presentation — what happens next (planning a flow, prioritizing,
completing tasks) is ordinary conversation, not this skill.

This skill is **read-only, enforced by mechanism**: every call carries `--readonly`,
which makes gog reject mutating API requests at runtime. Adding is `add-google-task`;
completing, editing, and deleting are out of scope — use `gog tasks` subcommands
directly (with the user's explicit go-ahead) when that need arises.

## Identity stays out of the repo

- The task list argument is always `@default`, and `-a` / `--account` is never passed.
- "Whose tasks" is resolved by the machine-local gog state (Keychain). Never hardcode
  an email address, list name, or list ID.

## Workflow

### 0) Preconditions

`command -v gog` and `gog auth status` must both succeed. If gog is missing or
unauthenticated, point the user to the setup path and stop:

```bash
gog auth credentials   # one-time client setup
gog auth add           # add an account
```

### 1) Derive the filter from context (don't interrogate)

The trigger is typically terse — "今日の task なに？". Map the utterance to flags
instead of asking:

- **Due window** — resolve relative expressions (今日, this week, 明日まで) against
  the system clock. Google Tasks stores due dates as **date-only, midnight UTC**
  (`YYYY-MM-DDT00:00:00.000Z`), so the local calendar date maps directly to the UTC
  date string — no timezone conversion. Filter with:

  ```
  --due-min <date>T00:00:00Z --due-max <date>T23:59:59Z
  ```

  Widen the window for ranges (this week → Monday..Sunday). No date mentioned →
  no due filter; show everything open.
- **Completed tasks** — excluded by default. Add `--show-completed --show-hidden`
  only when the user asks about finished work (「昨日何終わらせたっけ」).

### 2) Fetch

```bash
gog tasks list @default --json --readonly --no-input --max 100 [--due-min ... --due-max ...]
```

- `--max 100` (the allowed maximum) because the default page is 20 and a silently
  truncated task list defeats the point of looking. If `nextPageToken` is non-empty,
  fetch the next page rather than pretending the list ended.
- Don't use `--select`: its paths are envelope-relative (`tasks.title`, not `title`)
  and a wrong path returns a bare `{}` that looks exactly like "no tasks". Parse the
  full JSON instead.

### 3) Present and stop

The API returns manual-sort `position` order. When the question is deadline-shaped,
re-sort by `due` before presenting. Show, per task:

```
📋 今日が期限 (2026-07-28):
  1. <title> — 期限 7/28
     <one-line digest of notes, if any>
  2. ...
```

- Digest `notes` to one line; they often hold the how-to for the task, so don't drop
  them silently — offer the full text when it matters.
- Include `webViewLink` only when the user will plausibly open the task in Google
  Tasks; a wall of links is noise.
- An empty result is an answer, not an error: say the filter and that nothing matched
  (「今日期限の task はなし」).

Then hand the conversation back. If the user's real goal was 消化 or planning,
continue as normal conversation over the fetched data — but any write goes through
the user explicitly; this skill never segues into mutation on its own.

## Rules

- **Derive, don't interrogate.** Filters come from the utterance and the clock, not
  from field-by-field questioning.
- **`@default` only, no `-a`.** A different list is used only when the user names one
  explicitly, and only for that invocation — it never becomes a default.
- **`--json --readonly --no-input` on every call.** `--readonly` is the mechanical
  guarantee behind "this skill only looks"; never drop it.
- **No confirmation gate.** Reads are safe to just do — the summary-before-write
  ritual of `add-google-task` has no counterpart here.
- **Fetching ends the skill.** Completing, editing, deleting, and adding are out of
  scope; extend with a separate skill when a real need appears.
