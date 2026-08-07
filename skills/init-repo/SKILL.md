---
name: init-repo
description: >
  Initialize a brand-new GitHub repository and land in a ready-to-work checkout: create the
  remote with gh repo create, clone it under the ghq root, push a single empty "chore: init"
  commit as main's root, then cut a fixed `bootstrap` branch and stop there. Use when starting
  a repository from zero ("new repo", "repo 作って", "リポジトリ新規作成"). Init only — no
  README/LICENSE scaffolding, no PR, no CI or branch protection; those belong to later steps
  on the bootstrap branch.
---

# Init Repo

Goal: Go from "no repository" to "an empty repository with a clean root commit,
checked out locally on a `bootstrap` branch, ready for the first real work".

The design intent: `main` starts as a single empty commit and stays clean.
Everything that makes the repository useful — README, license, tooling — arrives
later via pull requests from the `bootstrap` branch. This skill only prepares
that starting line; it never writes project files itself.

## Why an empty init commit

A root commit with no files gives every later change — including the very first
README — a parent to diff against, keeps `git rebase -i --root` and `git bisect`
well-behaved, and means the actual scaffolding can go through a reviewable PR
instead of being baked into the root.

## Workflow

### 0) Preconditions

`gh auth status` and `ghq root` must both succeed. Surface errors and stop on
failure.

### 1) Gather the essentials

From the user (or the conversation), determine:

- **Repository name** — required.
- **Visibility** — `--public` or `--private`. If not stated, ask; never guess.
  Publishing a repository is outward-facing.
- **Owner** — default to the authenticated user, resolved concretely with
  `gh api user --jq .login` (a machine may hold several `gh` accounts). Only
  ask when an organization is plausibly intended.
- **Description** — optional; include only if the user provides one.

Confirm the combination (`owner/name`, visibility) with the user before
creating. This is the one confirmation gate in the flow.

### 2) Create the remote

```bash
gh repo create <owner>/<name> --private|--public [--description "<desc>"]
```

Do not pass `--license`, `--gitignore`, `--add-readme`, or `--clone` — any of
those would create a remote first commit and break the clean-root design.
If the name already exists, `gh` errors; surface it and stop.

### 3) Clone under the ghq root

```bash
ghq get <owner>/<name>
```

Cloning an empty repository warns; that is expected. Run everything after this
inside the clone:

```bash
cd "$(ghq root)/github.com/<owner>/<name>"
```

### 4) Root commit on main

The fresh clone has no commits yet, so HEAD is an unborn branch named by the
local `init.defaultBranch` — branch commands like `git switch` misbehave on it.
Point HEAD at `main` directly, then create the empty root commit and push:

```bash
git symbolic-ref HEAD refs/heads/main
git commit --allow-empty -m "chore: init" -m "Co-Authored-By: <your harness's co-author line>"
git push -u origin main
```

The second `-m` carries the `Co-Authored-By` trailer your harness convention
specifies — this commit is authored through the agent, same as any other.

### 5) Cut the bootstrap branch

```bash
git switch -c bootstrap
```

The branch name is fixed: `bootstrap`, always. Local only — it gets pushed
when the first real work goes up (typically via `publish-pr`).

### 6) Report

Give the user the repository URL, the local path, and the current branch
(`bootstrap`), and note that `main` holds exactly one empty commit.

## Boundaries

- **No project files.** README, LICENSE, justfile, `.gitignore` — all of it is
  bootstrap-branch work owned by other skills (`build-readme`,
  `build-justfile`) or the user.
- **No PR.** Opening the first PR belongs to `publish-pr`.
- **No CI / branch protection / repo settings.** Separate concerns, configured
  once there is something to protect.
- **Never proceed past step 1 without explicit confirmation** of owner, name,
  and visibility — repository creation is public-facing and annoying to undo.
- **Stop and explain** if `gh`, `ghq`, or auth is missing, or the target name
  already exists, rather than improvising.
