---
name: dads
description: >
  Reference knowledge for the Digital Agency Design System (DADS, デジタル庁デザインシステム):
  pinned design tokens, official dads-* component markup and porting rules, curated usage
  guidelines, and compliance policy. Use whenever output should look DADS-compliant —
  building a new page, artifact, or HTML document in DADS style, restyling an existing
  frontend to DADS (「DADS 風に」「デジタル庁デザインシステム準拠に」「デジタル庁っぽく」),
  auditing markup against official DADS components, or fetching DADS tokens/components from
  primary sources. This skill owns only the visual layer — colors, typography, components,
  usage rules, policy — and composes with whatever owns structure and medium (artifact-design,
  holy-grail-html, a React app, plain HTML edits). Triggers on "DADS", "デジタル庁デザイン
  システム", "dads-*", "digital-go-jp", "Japanese government design system".
---

# DADS — Digital Agency Design System

Knowledge for making output **look and behave like the Digital Agency Design System**
(デジタル庁デザインシステム, DADS) — Japan's government design system, MIT-licensed
tokens and components published by digital-go-jp.

## Scope: visual authority only

This skill answers one question: *what does DADS-compliant look like, and how do I get
there from primary sources?* It owns colors, typography, component markup, usage rules,
and the compliance policy below.

It deliberately does **not** own structure or medium. Compose it:

- New artifact → `artifact-design` (and the Artifact tool's constraints) own the medium;
  this skill owns the look. See `references/artifact.md` for where the two collide (CSP,
  dark theme).
- Long-form HTML doc → `holy-grail-html` owns the navigation shell; this skill replaces
  the free-form visual direction.
- Existing frontend restyle → the codebase owns structure; change only what the
  three-layer check below flags as deviating.

## The three-layer model

DADS compliance has three layers. Applying only the first produces "なんちゃって DADS" —
colors that look right on markup that an official page would never emit. Real deviations
(a table wrapped in a rounded container, a bold chip label) are invisible at the token
layer and only surface when compared against official component CSS.

| Layer | What it is | How to get it | What it buys |
| --- | --- | --- | --- |
| tokens | values — color hex, font, spacing, radius, elevation | pinned copy in `references/tokens.css` | plausible colors |
| components | shapes — markup, dimensions, `dads-*` class names | fetch per `references/components.md` | correct forms |
| guidelines | rules — when to use which | curated copies in `references/guidelines/` | correct choices |

Work top-down through all three for anything user-facing. Token-only application is
acceptable solely for throwaway internal sketches.

## Key token values (design-tokens 2.0.1)

The full file is `references/tokens.css` (226 lines, pinned verbatim). The values that
make or break the DADS look:

- Key color: `--color-key-*` = blue family; the anchor is blue-900 `#0017c1` (the Digital
  Agency blue).
- Semantic: error-1 = red-800 `#ec0000` / warning-yellow-1 = yellow-700 `#b78f00` /
  success-1 = green-600 `#259d63`.
- Font: `'Noto Sans JP', ...` — mono is `'Noto Sans Mono'`.
- Body text: 16px, line-height 1.75, **letter-spacing 0.02em** — omit the letter-spacing
  and nothing will read as DADS no matter how right the colors are.
- Heading sizes: 64/57/45/36/32/28/24/20/18/16 (there is no 22).
- Radius scale: 4/6/8/12/16/24/32/full.

## Components

Read `references/components.md` before touching any component. The one rule worth
stating here: **port official `dads-*` class names and CSS verbatim** — never transcribe
values into homemade classes, or the result can no longer be diffed against the official
source when it drifts.

Pick components from `references/guidelines/components-index.md` (the official catalog).
Per-component usage guidelines for the ones already battle-tested (notification-banner,
table, heading) plus color/typography foundations are in `references/guidelines/`.

## Policy (always in force)

- **No impersonation.** Tokens and components are MIT; the Digital Agency's logo,
  illustration assets, and name are not part of that grant. Never produce something that
  reads as an actual Digital Agency page. DADS-styled ≠ Digital-Agency-branded.
- **Label extensions as extensions.** Official DADS is light-only (`white` hardcoded).
  A dark theme is a DADS-*compliant extension*, not official DADS — derive it per
  `references/artifact.md` and say so in the page footer or equivalent.
- **Attribution** for guideline excerpts follows the official notice:
  https://design.digital.go.jp/dads/introduction/notices/ — each bundled guideline file
  keeps its `source_url` frontmatter for this reason.

## Refreshing pinned sources

The pins keep this skill reproducible; refresh deliberately, not per-use.

```bash
# tokens — check the published version before overwriting the pin (currently 2.0.1)
curl -sL https://unpkg.com/@digital-go-jp/design-tokens@latest/package.json | jq -r .version
curl -sL https://unpkg.com/@digital-go-jp/design-tokens@latest/dist/tokens.css

# guidelines — the ZIP link is dated with no latest-URL; scrape it from the resources page
# (bundled copies are from dads-markdown-20260805.zip)
curl -sL https://design.digital.go.jp/dads/resources/ | grep -oE '/dads/dads-markdown-[0-9]+\.zip'
```

Components are fetched live (see `references/components.md`) rather than pinned — the
set is large, and live fetch preserves diff-ability against the current official source.

## Dead ends (do not revisit)

- `design.digital.go.jp/llms.txt` — 404, does not exist.
- `tokens.css` at the npm package root — the real file is under `dist/`; list with
  `https://unpkg.com/@digital-go-jp/design-tokens@latest/?meta` first.
- `digital-go-jp/tailwind-theme-plugin` — a repackaging of the tokens, zero new
  information unless the target project already uses Tailwind.
- `components/chip-label` guideline — official doc is a "準備中" stub; the porting notes
  in `references/components.md` are the best available source.
