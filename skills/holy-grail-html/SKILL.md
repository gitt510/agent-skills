---
name: holy-grail-html
description: >-
  Build a standalone, self-contained HTML document using the Holy Grail layout —
  a full-width masthead on top, then three columns: a sticky auto-generated
  contents-tree (TOC) that tracks scroll on the left, the body in the center,
  and a manual Related links rail on the right. Writes the result to
  `{slug}.html` in the directory the skill is invoked. Use whenever the user
  wants a navigable reference, guide, explainer, or spec as an HTML file and
  would benefit from in-page navigation. It owns the navigation structure; for
  visual direction it invokes frontend-design, and for up-to-date HTML/CSS
  practice it invokes modern-web-guidance. Triggers on "holy grail layout" /
  「holy grail の doc 作って」 / "3-column reference html" / 「目次つき/3カラムの
  html doc」 / "doc with a table of contents" / 「reference を html で」 /
  "scroll-tracking TOC" / 「スクロール追従の目次つき doc」.
---

# Holy Grail HTML

Produce a **standalone, self-contained HTML document** using the [Holy Grail layout](https://alistapart.com/article/holygrail/): a full-width masthead on top, then three columns — an auto-generated contents-tree (TOC) on the left that tracks the reader's position as they scroll, the body in the center, and a Related rail on the right. The TOC builds itself from the body headings. The result is written to `{slug}.html` in the directory the skill is invoked — a single file that opens by double-click, with no server or publishing step.

## What this skill owns

This skill owns one thing: the **navigation shell** — a full-width masthead, then three columns with an auto-generated, scroll-tracking contents-tree on the left and a manual Related rail on the right. The only invariant is that shell: the 3-column grid, the sticky rails, and the TOC/scrollspy script (see *The navigation mechanic*). Keep those intact and the navigation works.

Everything *visual* on top — the masthead, palette, typography, the one signature element — is **not** fixed here. There is no built-in theme to fall back on:

- **`frontend-design`** — the distinctive visual direction. Invoke it (see Workflow) and design the look fresh, deliberately, for this document.
- **`modern-web-guidance`** — current HTML/CSS practice. Invoke it (see Workflow) before writing markup, so the implementation doesn't lean on stale patterns.

## Naming, for the record

This shell is a named pattern, not an invented one:

- **Shape** — masthead + 3-column body with fixed-width sides and a fluid center is the **[Holy Grail layout](https://alistapart.com/article/holygrail/)**, popularized by Matthew Levine's 2006 *A List Apart* piece (the name itself predates that article). The textbook version also has a full-width footer; this skill's shell stops at the 3-column body and doesn't require one.
- **Left rail** — an auto-generated, scroll-tracking table of contents for a single long document. Real-world placement is mixed, not uniformly left — the [WHATWG HTML spec](https://html.spec.whatwg.org/) puts its own on the left, Docusaurus puts its own on the right. There's no dominant proper name for the sidebar itself, but the scroll-tracking behavior does have one: **[Scrollspy](https://getbootstrap.com/docs/5.3/components/scrollspy/)**.
- **Right rail** — related-but-not-essential material placed beside the text it concerns. [Tufte CSS](https://edwardtufte.github.io/tufte-css/) calls this **sidenotes/margin notes**; [Distill.pub's template](https://github.com/distillpub/template) calls the equivalent region `l-gutter` — for marginalia and asides, not footnotes (Distill handles those separately).

Knowing the names matters less than knowing this is well-trodden ground — none of the three pieces need re-inventing.

## Output

- **File** — write to `{slug}.html` in the **current working directory** (where the skill was invoked). `slug` is a short kebab-case form of the document title.
- **Standalone** — a full HTML document (`<!doctype html>` → `<html>` → `<head>` → `<body>`), not a fragment. It opens locally by double-click.
- **Self-contained** — inline all CSS and JS, embed images as `data:` URIs, and use no external/CDN dependencies. The file stays portable (emailable, hostable anywhere) and the scroll-tracking works offline. This is why the TOC/scrollspy is hand-rolled rather than a library.

## Layout — a fixed navigation shell, free body

The only thing fixed is the **shell**: a full-width masthead band on top, then three columns below — contents-tree, body, Related. The viewer is a desktop browser, but side rails don't need to be raw fixed pixels to stay desktop-only: they use **bounded fluid** widths — a `clamp()` between a stable min and max — because their content is navigation with a natural size, not prose. They shift a little between a laptop and a 4K monitor but never balloon or starve. The main column absorbs whatever's left, capped at a measure that's still diagram-friendly. Below ~900px a single minimal fallback kicks in (see *Narrow-viewport fallback*) so the page never side-scrolls or clips content; it is not a responsive redesign. Everything *inside* the shell — the masthead, type, palette, section density — is free-form, designed per `frontend-design`.

```
┌─────────────────────────────────────────────┐
│                  masthead                     │  ← free-form: the page's thesis
├──────────┬──────────────────────┬────────────┤
│ contents │     main content     │  Related   │
│  -tree   │   (measure ~900px)   │  (sticky,  │
│ (sticky, │                      │   manual)  │
│  spy)    │                      │            │
└──────────┴──────────────────────┴────────────┘
 clamp(12.5–16.25rem)  minmax(0,56.25rem)  clamp(13.75–17.5rem)
```

- **Masthead (top)** — a full-width opening band, the page's thesis (`frontend-design`: "the hero is a thesis"). The `h1` lives here, alongside a kicker/eyebrow and deck if the content calls for one. Designed wholesale; not part of the fixed shell.
- **Contents-tree (left)** — sticky, auto-generated from the `h2`/`h3` in `<main>`; the current section highlights on scroll. The author writes headings, not the TOC.
- **Main (center)** — the body, at a comfortable reading measure, bounded up to ~900px so wide diagrams and tables have room without forcing every paragraph that wide.
- **Related (right)** — a sticky, **manually built** list of links out (title + optional one-line note + URL). There is no mechanism to discover related pages automatically — fill it by hand or omit it.
- **2-column fallback** — when there are no Related links, drop the right rail (`class="no-related"` on `.page`) so the layout doesn't leave a dead column.
- **Narrow-viewport fallback** — below ~900px, the three columns stack into one (contents-tree, then main, then Related), and the rails switch from sticky to static. The intended reader is a desktop browser, so this isn't a responsive redesign — just enough that the page never side-scrolls or clips. Tufte CSS and Distill.pub do the same thing: fold the margin column into the body flow at narrow widths rather than hide it.

## Workflow

1. **Set the visual direction first.** Invoke `/frontend-design:frontend-design` for the direction — masthead, palette, type, the one signature element. There is no default theme; the look is designed, not filled in.
2. **Load current web practice.** Invoke `modern-web-guidance` before writing any markup — web APIs move fast, and this keeps the CSS/JS off stale patterns.
3. **Build a standalone document.** Write a full `<html>` doc — `<head>` with charset, viewport, `<title>`, and an inline `<style>` — and the body below, styled per that direction.
4. **Drop in the navigation mechanic** (below): the 3-column grid + sticky rails, and the scrollspy `<script>`. Don't re-derive the script — it handles id generation, the contents-tree, smooth scroll, and active-section tracking.
5. **Write the content** — the masthead (`h1` + opening), then `h2`/`h3` sections under `<main>`. The contents-tree picks the headings up automatically; never hand-write the TOC. Build the Related rail by hand, or omit it and add `class="no-related"` to `.page`.
6. **Write the file** to `{slug}.html` in the cwd.

## The navigation mechanic

The one part worth not re-deriving. Structure only — no colors, type, or masthead look; design those per `frontend-design`.

Markup — a full-width `.masthead` band, then a `.page` grid:

```html
<header class="masthead">…h1 + opening…</header>
<div class="page">
  <nav class="toc"><ul id="toc-list"></ul></nav>      <!-- filled by the script -->
  <main class="main">…h2/h3 + body…</main>
  <aside class="related">…manual links out…</aside>  <!-- omit + add .no-related if none -->
</div>
```

```css
/* navigation shell — structure only; design palette, type, masthead per frontend-design */
* { box-sizing: border-box; }

/* side rails: bounded fluid (clamp) — stable min/max in rem (zoom-resilient, unlike
   raw px) since their content is nav, not prose. Not a 1:X:1 ratio: rail width tracks
   what navigation needs, not a share of whatever screen it's on. */
.page { display: grid;
        grid-template-columns:
          clamp(12.5rem, 14vw, 16.25rem)
          minmax(0, min(56.25rem, 100%))
          clamp(13.75rem, 15vw, 17.5rem);
        max-width: min(94vw, 93.75rem); margin: 0 auto; align-items: start; }
.page.no-related { grid-template-columns:
          clamp(12.5rem, 14vw, 16.25rem)
          minmax(0, min(56.25rem, 100%));
        max-width: min(94vw, 73.75rem); }
.toc, .related { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto; }
#toc-list { list-style: none; margin: 0; padding: 0; }
.scroll-x { overflow-x: auto; }   /* wrap wide tables/code; the page never scrolls sideways */
/* the script sets .lvl-h3 on h3 entries (indent them) and toggles .is-active on the
   current section's TOC link — style both as part of the design */

/* narrow-viewport fallback — stack to one column, rails go static. Not a responsive
   redesign: the audience is desktop, this just keeps a narrow window from breaking. */
@media (max-width: 900px) {
  .page, .page.no-related { grid-template-columns: 1fr; max-width: 47.5rem; }
  .toc, .related { position: static; height: auto; overflow: visible; }
}
```

```html
<script>
  // Build the contents-tree from the h2/h3 in <main>, then highlight the current
  // section on scroll. Pure DOM, no dependencies.
  (function () {
    var main = document.querySelector('.main');
    var list = document.getElementById('toc-list');
    if (!main || !list) return;
    var heads = Array.prototype.slice.call(main.querySelectorAll('h2, h3'));
    var used = {};
    function slug(t) {
      var s = t.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'section';
      if (used[s]) { used[s]++; s = s + '-' + used[s]; } else { used[s] = 1; }
      return s;
    }
    var items = heads.map(function (h) {
      if (!h.id) h.id = slug(h.textContent);
      var li = document.createElement('li');
      li.className = 'lvl-' + h.tagName.toLowerCase();
      var a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = h.textContent;
      li.appendChild(a); list.appendChild(li);
      return { h: h, a: a };
    });
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return;
      e.preventDefault();
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + target.id);
      }
    });
    var OFFSET = 100;
    function onScroll() {
      var current = items.length ? items[0] : null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].h.getBoundingClientRect().top - OFFSET <= 0) current = items[i]; else break;
      }
      items.forEach(function (it) { it.a.classList.toggle('is-active', it === current); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();
</script>
```

## Filling in

- **Headings drive navigation.** Every `h2`/`h3` in `<main>` becomes a TOC entry (h3 nested under h2) with a generated `id`. Write clear, distinct headings and the tree takes care of itself.
- **Related is links *out*, the TOC is navigation *in*.** Keep them distinct — never list the same items in both rails.
- **Wide blocks scroll inside themselves.** Wrap tables, diagrams, or wide code in a `.scroll-x` container. The page body itself must never scroll horizontally.
- **Hyphenated identifiers always need a nowrap guard.** A kebab-case name (`acme-search-ui`, `auth-broker`) will break mid-word at the hyphen — `-` is a universal Unicode line-break opportunity (UAX #14), not a CJK quirk; it's just more visible in CJK prose because there's no surrounding space to break at instead. No paragraph-level CSS fixes this (`word-break: keep-all`, `line-break`, and `hyphens: none` all leave a literal `-` breakable). Wrap every such identifier in `<code>` and give `code` a base `white-space: nowrap` — do this consistently while writing the content, not as a patch after noticing one broke.
- **Keep the masthead deck to one thesis sentence.** Don't repeat every proper noun that already appears in the eyebrow or `h1`. Each inline `<code>` term is a small interruption to reading flow; three of them packed into one sentence reads as clutter no matter how the line wraps.

## Styling

The look is yours to design per `frontend-design` — there is no baseline theme to fall back on, by design. The one constraint: leave the grid, the sticky rails, and the scrollspy script intact and the navigation keeps working. Layer the masthead's character, the type scale, the palette, and the one signature element on top. Match ambition to content — a minimal direction still needs precise spacing and type; a bolder one earns its signature element.
