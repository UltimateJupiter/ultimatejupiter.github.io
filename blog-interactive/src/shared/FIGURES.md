# Writing an interactive data figure

A data figure is three files in a post's `figs/` folder, `<name>.html`, `<name>.css`, and `<name>.js`, placed in the page with `<!--FX:<name>-->`. `build.py` inlines the HTML at that marker and bundles the CSS and JS into the post's `figures.css` and `figures.js`.

Figures sit in the 640px text column and must also work at a 375px phone width (text column about 331px). They build on:
- `shared/base.css`: page tokens (`--bg --fg --muted --rule --line --accent --loss --good`), typography, figcaption style.
- `shared/fx.css`: `.fx`, `.fx-bar`, `.fx-select`, `.fx-seg`, `.fx-panels`, `.fx-panel`, `.fx-ptitle`, `.fx-psub`, `.fx-svg` (+ `.ax`, `.gr`, `.hair`), `.fx-tip`, `.fx-legend`, `.fx-status`, `.fx-note`, `.fx-scale`, and colour tokens `--fx-c1..c5`, `--fx-base1..3`, `--fx-gate`, `--fx-band`.
- `shared/select.js`: turns every `<select class="fx-select">` inside a `figure.fx` into the custom menu. The native select stays the source of truth, so figure code just reads `select.value` and listens for `change`.
- `window.FIGDATA`: the post's `data.js`, loaded before the figure scripts.

Preview a figure alone with `tools/harness.html?f=<name>&post=<slug>` (served from the site root), or the whole page with `tools/smoke.html` (see the README).

## Fragment (`<name>.html`)
- Exactly one element: `<figure class="fx" id="fx-<name>"> … <figcaption>…</figcaption></figure>`.
- Static structure only (controls, empty containers, caption). The script fills the charts.
- TeX is allowed only in static text (caption, static labels) as `\( … \)`; MathJax typesets it once at page load.
  Never inject TeX from JS — dynamic text uses plain Unicode (α, δ, −, ×, ≤, …) and `<sub>`/`<sup>`.
- Caption: begins with the figure label you are given (e.g. `Figure 2.`), then 2–5 short, factual sentences: what is plotted,
  how to use the controls, what the colours/marks mean, and the interval method. No claims beyond the data.

## CSS (`<name>.css`)
- Every selector starts with `#fx-<name>`. No global selectors, no `!important` except for reduced-motion.
- Colours only through tokens: `--bg --fg --muted --rule --line --accent --loss --good --fx-*`. If you need a new colour,
  define a token under `:root` with BOTH dark variants exactly like `fx.css` does
  (`@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){…}}` and `:root[data-theme="dark"]{…}`), and prefix it
  `--fx-<name>-…`.
- Heatmap / intensity fills: set them as inline style, e.g. `rect.style.fill = 'color-mix(in oklab, var(--loss) 63%, var(--bg))'`,
  so theme switches need no redraw. Neutral midpoint = `var(--bg)`. Loss = `var(--loss)` (red), gain = `var(--accent)` (blue).
- Layout must not overflow horizontally at 375px. Two-panel layouts use `.fx-panels` (stacks below 600px).

## Script (`<name>.js`)
- One IIFE with `'use strict'`; no globals; return early if `document.getElementById('fx-<name>')` is missing.
- Plain DOM + inline SVG (`document.createElementNS`), class `fx-svg` on chart `<svg>`s. No libraries, no network, no storage.
- Size the SVG to the real container width (viewBox width = clientWidth, height fixed per chart) and re-render on width
  change with a ResizeObserver (ignore height-only changes). Text therefore stays at true pixel sizes.
- Tooltips: one `.fx-tip` div appended to the figure (the figure is `position:relative`); follow the pointer; clamp inside
  the figure; use Pointer Events (`pointermove`, `pointerdown` for touch, `pointerleave` hides). Add a thin crosshair
  (`.hair`) or a highlight on the hovered element.
- Controls: native `<select class="fx-select">` (with `<optgroup>`s when useful) and `<button>`s in `.fx-seg`
  (`aria-pressed`). Every control has an accessible name. Keyboard must reach everything that the mouse can do (a row
  that can be clicked must also be selectable from a control or by keyboard).
- Each chart `<svg>` gets `role="img"` and an `aria-label` that states what it shows for the current selection.
  One `.fx-status` element with `aria-live="polite"` summarises the current selection with numbers.
- Transitions are optional and short (≤ 300 ms); honour `prefers-reduced-motion`.
- No console output except genuine errors. Keep each figure under ~6,000 SVG nodes.

## Visual language
Axis labels and ticks: mono 10.5px, `--muted`. Panel titles: `.fx-ptitle` (sans 13px). Numbers: mono.
Lines 1.75px (selected) / 1.25px (context); markers ≥ 6px when used; CI bands: series colour at ~15–20% opacity.
Axes as single hairlines (`.ax`), light gridlines (`.gr`) only where they aid reading; no chart borders, boxes or shadows.
Reserve red (`--loss`) for accuracy lost and blue (`--accent`) for gains/selection; use greys (`--fx-base*`) for context
series. Prefer direct labels over legends; if ≥ 2 series need identification, add a `.fx-legend`.
Match the post's tone: quiet, precise, technical.

## Testing (required before you report)
A shared static server serves the blog folder: `http://127.0.0.1:8765/figs/harness.html?f=<name>`.
If `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8765/figs/harness.html` is not 200, start your own:
`cd <blog folder> && python3 -m http.server <8770–8799> --bind 127.0.0.1 &` and use that port.

Screenshot + console (headless Chrome; ~5–10 s per shot):
```
python3 figs/shot.py "http://127.0.0.1:8765/figs/harness.html?f=<name>&theme=light" /tmp/claude-501/<name>-light.png --w 1280 --h 1400
python3 figs/shot.py "http://127.0.0.1:8765/figs/harness.html?f=<name>&theme=dark"  /tmp/claude-501/<name>-dark.png  --w 1280 --h 1400
python3 figs/shot.py "http://127.0.0.1:8765/figs/harness.html?f=<name>&theme=light" /tmp/claude-501/<name>-375.png   --w 375 --h 1800
```
Simulate interaction with `&do=<url-encoded async JS>` (runs after your script initialised), e.g. select another model and
dispatch a `change` event, click a button, or dispatch a `pointermove` at a chart coordinate to screenshot a tooltip.
The harness logs `FX-CHECK … docOverflow=N` — it must be 0 at 375px and 1280px — and prints any `UNCAUGHT` error.
Look at every screenshot with the Read tool; iterate until it is genuinely clean and elegant in both themes.

## Report (your final message)
Files written; a short description of the design and interactions; the exact caption text; the harness URLs/`do=`
snippets you used; screenshot paths; any data caveats or doubts about the numbers. Keep it under ~300 words.
