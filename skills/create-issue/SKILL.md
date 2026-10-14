---
name: create-issue
description: File a new GitHub issue with gh issue create. Use when opening an issue on a repository.
---

# Create Issue

## Steps

### 1. Check gh

`gh repo view` and `gh auth status` must both succeed. Stop and show the error
otherwise.

### 2. Propose the title

`<type>: <summary>`, where `<type>` is a Conventional Commits type. Never a bare
title. Wait for the user to confirm it.

### 3. Check for duplicates

```bash
gh issue list --search "<keywords>" --state all --limit 10
```

Show plausible matches with number, title, and state, and let the user decide
whether to continue.

### 4. Write the body

If the repository has an issue template under `.github/ISSUE_TEMPLATE/`, follow
the one that fits. Writing the body is owned by the **writing-documents** skill
— invoke it and follow its rules. This skill carries no skeleton or format
knowledge of its own. Never invent facts the user did not give.

### 5. Preview and create

Show the title and body in full and loop until the user approves, then:

```bash
gh issue create --title "<title>" --body-file <file>
```

Give the user the issue URL.

## Boundaries

- **No metadata.** Never set or edit labels, assignees, milestones, projects,
  or other fields.
