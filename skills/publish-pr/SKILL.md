---
name: publish-pr
description: >
  Publish the current local changes to GitHub in one shot — confirm scope, commit, push, and
  open a ready pull request. Use whenever the user wants to ship finished local work to a PR
  ("open a PR for this", "publish this", "commit, push, and PR", "ship it"), even when the ask
  is terse, as long as there are local changes meant to go up. This is git + PR mechanics
  only: it does NOT merge (stop at opening the PR) and does NOT run tests/build/lint
  (correctness is a separate concern — see the boundary notes below).
---

# Publish PR

Take whatever is in the working tree right now and turn it into an open pull
request: figure out what should go in, commit it, push the branch, and open the
PR. Nothing more.

The job is deliberately narrow. "Is the code correct?" and "should this be
merged?" are real questions, but they belong to other tools (a verify step, CI,
a human reviewer, a future `merge-pr`). Folding them in here would make the
one-shot slow and ambiguous, so this skill leaves them out on purpose.

## Workflow

### 1. See what's actually there

```bash
git status -sb
git diff HEAD
git branch --show-current
```

Read the diff before touching anything. You need to know what's staged, what's
unstaged, and whether the current branch is a shared default branch.

### 2. Decide scope before staging

If everything in the tree clearly belongs to one change, stage it all. But if
the tree is **mixed** — unrelated edits, stray debug prints, an unrelated file —
do not reach for `git add -A`. Silently sweeping unrelated work into someone's
PR is the kind of mistake that's annoying to unwind. Ask which files belong,
then stage those paths explicitly.

### 3. Branch if you're on the default branch

If the current branch is `main` / `master` / the repo's default, create a new
branch first — committing straight onto a shared default branch is what you're
trying to avoid by opening a PR at all. Use a short, descriptive branch name
derived from the change; if the repo has an obvious branch-naming convention,
follow it. If already on a feature branch, stay on it.

### 4. Commit

Use a terse, scoped message:

```
<area>: <subject>
```

`<area>` is the part of the codebase or component touched; `<subject>` says what
changed, in the imperative. Keep it to one line unless the change genuinely
needs a body.

**Examples:**

- `auth: reject expired refresh tokens`
- `docs: fix broken link in setup guide`
- `fish: add gh-issue-pull abbr`

Add the `Co-Authored-By` trailer identifying the agent that made the commit —
these commits are authored through the agent, not by hand, so attribute them.
Use the co-author line your harness convention specifies.

### 5. Push

```bash
git push -u origin $(git branch --show-current)
```

### 6. Open the PR (ready, not draft)

```bash
gh pr create --title "<title>" --body-file <file>
```

Writing the body is owned by the **build-pr-description** skill — invoke it and
follow its rules and procedure. This skill carries no skeleton or format
knowledge of its own.

Default to a **ready** PR; only pass `--draft` if the user asks for a draft.

### 7. Report

Give the user the branch name, the commit, and the PR URL, plus anything still
needing their attention (e.g. an unrelated change you left unstaged).

## Boundaries

- **No merge.** Stop at an open PR. Merging is a separate decision (CI, review,
  merge strategy) and lives in its own flow.
- **No test/build/lint run.** This skill won't guess and run a project's checks
  — that's unbounded and overlaps with CI. If the user wants pre-push
  verification, they run it deliberately beforehand.
- **Never stage unrelated changes silently** (see step 2).
- **Stop and explain** if the repo has no accessible GitHub remote, or `gh` /
  auth is missing, rather than guessing.
