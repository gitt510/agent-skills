# DADS components — fetching and porting

## Fetch recipes (live, not pinned)

The official HTML implementations live in `digital-go-jp/design-system-example-components-html`.
Fetch live so the port can always be diffed against the current source.

```bash
# list every component
gh api repos/digital-go-jp/design-system-example-components-html/contents/src/components --jq '.[].name'

# list one component's files (each has {name}.css plus variant html files)
gh api repos/digital-go-jp/design-system-example-components-html/contents/src/components/{name} --jq '.[].name'

# fetch a file's content
gh api repos/digital-go-jp/design-system-example-components-html/contents/src/components/{name}/{file} --jq '.content' | base64 -d
```

React versions exist in `design-system-example-components-react` — only go there when
the target is a React codebase; the HTML repo is the reference otherwise.

Component CSS assumes `src/global.css` from the same repo — it carries the `html`
font-family, link colors, `:focus-visible`, and the `.dads-u-*` type utilities. Fetch it
alongside the components and port the parts the page actually uses, or the base
typography silently falls back to browser defaults:

```bash
gh api repos/digital-go-jp/design-system-example-components-html/contents/src/global.css --jq '.content' | base64 -d
```

## Precedence when sources disagree

**Live component CSS wins over the bundled guidelines.** The guidelines in
`references/guidelines/` are a dated snapshot; the component repo is the moving,
normative source (observed in practice: the notification-banner guideline names
warning-yellow-1 for the border while current CSS uses warning-yellow-2). When they
conflict, port what the live CSS says and move on.

## The porting rule

Port the official `dads-*` class names and their CSS **verbatim** into the target,
trimming only unused variants. Never transcribe values into homemade class names: a
`.my-callout` with DADS values cannot be diffed against the official `.dads-notification-banner`
six months later, and silent drift is exactly how "なんちゃって DADS" happens.

The official CSS references token variables (`--color-*` etc.) — bring the referenced
variables along from `tokens.css` (see SKILL.md → artifact/CSP notes for self-contained
targets).

The rule's scope is *components*: its rationale is keeping ports diff-able against the
official source. DADS ships no page-shell/layout component, so the page wrapper
(max-width, padding, footer) legitimately uses your own plainly-named classes — just
keep them visibly non-`dads-*` so the boundary stays obvious.

## Battle-tested components (report-style documents)

Gotchas learned by diffing a real port against official CSS — each one was a deviation
that token-level styling could not catch.

### dads-notification-banner — callouts, verdicts

- Border is **3px** (not 1–2px), radius 12.
- Use the official SVG icons — error is a diamond with an ×; desktop icon size 44px.
- Variants: `data-style="standard"`, `data-type="error|warning|success|info-1|info-2"`.

### dads-table

- **Never wrap the table in a rounded container** — official tables sit flush.
- A captioned table is `<figure class="dads-table">` + `<figcaption class="dads-table__caption">`,
  **not** a `<caption>` inside `<table>` — the native caption silently breaks the
  component's flex `row-gap`. Check the official `with-caption.html` variant.
- Column header `__col-header`: gray-100 background + 1px black bottom rule.
- Inner rules are gray-420, applied via attributes like `data-cell-border="top"`. The
  attribute's host element varies across official variants (`<table>` in some,
  `<tbody>` in others) — both are official; match whichever variant you ported.
- `data-size="dense"` exists for compact tables.

### dads-chip-label — status chips

- Radius 8, min-height 32, **font-weight normal** (bold reads as non-DADS immediately).
- Variants: `data-style="text|outlined|filled-1|filled-2"` ×
  `data-color="red|yellow|green|..."`.
- Color pairs are officially defined per color — e.g. red = red-50 background /
  red-1000 text / red-900 border. Take the pair from the official CSS, don't compose one.
- The usage guideline page is a stub (準備中); the official CSS is the only normative
  source for this component.

### dads-heading

- An eyebrow/kicker is an official part: the `__shoulder` element — a `<p>` inside
  `<hgroup>`, never an extra `<h*>`.
- Left accent bar: `data-chip` (width 1em/3, color key-900).
- Underline rule: `data-rule="2|4|6|8"`.
- DADS deliberately decouples heading *level* from *size* (`data-size`) — the official
  guideline defers the mapping to each service's style guide. There is no DADS default:
  pick sizes for the document's own hierarchy and keep the mapping consistent within it.
