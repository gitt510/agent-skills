---
name: dev-port-assignment
description: Rules for assigning a project's local dev servers fixed ports derived from the project name, so projects running side by side rarely collide. Use when choosing or changing a dev server port, when a default port such as 3000, 5173, or 8080 is already taken, or when setting up a new project's dev server.
---

# dev-port-assignment

Derive the port from the project name instead of keeping the tool's default or picking a number by hand. Where the project already has its own port convention, follow that instead.

## Formula

```sh
echo $((10000 + $(printf '%s' "<project>" | cksum | cut -d' ' -f1) % 20000))
```

`<project>` is the repository name, such as `cogmo-crawler` → `23532`.

## Rules

1. Use the repository name as `<project>`, without the owner, in its exact case and with no trailing newline
2. Give the main dev server the derived port, the base
3. Give each further server in the same project the next number: base + 1, base + 2, in the order a developer opens them
4. Fail when the port is taken instead of moving to another one, such as `strictPort: true` in Vite
5. Leave the formula in a comment beside the port, so the number can be re-derived
6. Replace every reference to the old port in the same change: proxy targets, CORS origins, `.env` files, README, justfile, and test config
7. Leave ports the project does not own unchanged, such as a database in Docker or a production port

## Why this range

| Range | What lives there | For a dev server |
| --- | --- | --- |
| 0–1023 | System services; binding normally needs privileges | Avoid |
| 1024–9999 | Tool defaults: 3000, 5173, 5432, 8080, 8787 | Collides often |
| 10000–29999 | Few tool defaults, such as Ollama on 11434 and MongoDB on 27017 | Use this |
| 32768–60999 | Ephemeral ports on Linux by default | Avoid |
| 49152–65535 | Ephemeral ports on macOS by default and in the IANA assignment | Avoid |

- 10000–29999 is a practical choice, not reserved space: IANA registers ports up to 49151
- An ephemeral port can be held by an outgoing connection, so a server bound there fails to start on some days
- A four-digit scheme such as `8000 + hash % 1000` has 1,000 slots, and 40 projects with one port each already collide with a probability above one half
- 20,000 slots bring that to about 4%, or about 18% when each project takes three consecutive ports

## Example

```ts
// vite.config.ts in cogmo-crawler
server: {
  // 10000 + cksum("cogmo-crawler") % 20000
  port: 23532,
  strictPort: true,
},
```

The API in the same project takes `23533`, and the docs site `23534`.

## When an assigned port is taken

The formula lowers the odds of a collision; it does not rule one out. Two clones, forks, or worktrees of the same repository derive the same ports.

Check what holds the port before changing anything:

```sh
lsof -nP -iTCP:<port> -sTCP:LISTEN
```

- If it is a stale run of the same project, stop that process
- If it is another copy of the same repository meant to run in parallel, override the port for that run only, through the tool's flag or environment variable
- If it is a different project or tool, choose another base in 10000–29999 by hand, check that every port of the project is free, and replace the formula in the comment with the reason
