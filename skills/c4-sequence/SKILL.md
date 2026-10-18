---
name: c4-sequence
description: Rules for drawing a route through a system as a Mermaid sequence diagram, following the C4 dynamic diagram with responses and gating steps added. Use when drawing how a request travels between people, containers, and external systems.
---

# c4-sequence

Draw the route under the following rules.

## Rules

1. Draw one route per `sequenceDiagram`, under a heading that names the route.
2. Number every step with `autonumber`.
3. Keep every participant at one C4 level: people, containers, and external systems.
4. Name a person by role, such as `User`, never by a personal name.
5. Merge what deploys together into one container, such as a Worker and the static assets it serves.
6. Label a request `->>` with what it does and its technology: `Verb phrase [technology]`.
7. Label a response `-->>` with what comes back: `status or data [format]`.
8. Draw a self-call `X->>X` only for a step that decides whether the route goes on, such as verifying a token or authorizing a user.
9. Leave out what lives below the container level: header and cookie names, function names, libraries, and steps that never stop the route.
10. Write no prose and no `Note` blocks.

## Example

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant SPA as Browser (Vue SPA)
  participant Access as Cloudflare Access
  participant Worker as Worker (bibles)
  participant Neon

  User->>SPA: Opens bibles
  SPA->>Access: Requests bibles [HTTPS/JSON]
  Access->>Access: Verifies the session
  Access->>Worker: Forwards the request [JWT]
  Worker->>Worker: Verifies the JWT (signature, iss, aud, exp)
  Worker->>Neon: Reads bibles [SQL/HTTPS]
  Neon-->>Worker: Rows
  Worker-->>SPA: 200 OK [JSON]
```
