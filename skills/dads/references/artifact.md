# DADS in self-contained HTML (artifacts)

Deviations required every time DADS goes into a self-contained HTML page — a published
Artifact or any single-file document. Structure and dimensions stay official; only
delivery and theming change.

## CSP: inline everything

Artifacts block all external hosts, so:

- Inline only the token variables actually referenced into a `<style>` block — not all
  226 lines of `tokens.css`.
- Drop the Google Fonts `<link>` that official component HTML carries. Use the fallback
  stack `"Noto Sans JP", "Hiragino Sans", sans-serif` — macOS/iOS render Hiragino,
  environments with Noto installed render Noto, and the metrics are close enough that
  the layout holds. (Artifacts *can* load Google Fonts via fonts.googleapis.com — the
  one CSP exception — so linking Noto Sans JP there is acceptable when fidelity matters;
  keep the fallback stack regardless.)
- Official SVG icons get inlined into the markup.

## Dark theme: a compliant extension, not official DADS

Official DADS is light-only — `white` is hardcoded in component CSS. To support the
artifact viewer's dark mode:

1. Keep structure, dimensions, and class names unmodified.
2. Replace only color *references* with semantic variables (`--surface`, `--ink`, etc.)
   defined from the DADS primitives.
3. Derive dark values from the primitive scales — the light theme's blue-900/red-800/
   yellow-700/green-600 anchors map to the blue-400 / red-300 / yellow-300 / green-300
   bands for dark surfaces.
4. Declare it: note in the footer (or equivalent) that the dark theme is a
   DADS-compliant extension, not an official DADS theme.

Follow the Artifact tool's own theme contract (tokens on `:root`, `prefers-color-scheme`
guarded with `:not([data-theme="light"])`, `[data-theme="dark"]` override) — this file
only defines *which* colors, not the mechanics.

## Impersonation guard

Applies with extra force here because artifacts get shared as URLs: no Digital Agency
logo, illustration assets, or name. A DADS-styled report must not be mistakable for a
Digital Agency publication.
