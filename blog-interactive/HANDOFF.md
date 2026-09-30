# Handoff notes for integrating this into the site

Read README.md first. Things that are easy to get wrong:

- **Serve `docs/`, or copy from it.** `docs/` is the built site. If the existing site has its own structure, copy `docs/shared/` and `docs/periodic-weak-spots/` so they stay siblings: the post loads `../shared/`. All paths are relative, and nothing is loaded from a CDN.
- **Keep `docs/.nojekyll`** (or equivalent) so GitHub Pages serves the files untouched.
- **Edit `src/`, not `docs/`.** After any change run `python3 build.py` (Python 3 standard library only). It rebuilds `docs/` and `dist/`.
- **Do not add the raw data export to the repository.** `src/posts/periodic-weak-spots/data.js` is already generated. The build refuses output containing an internal training-data tag on run ids; if that check fails, the fix is to regenerate data with `data-src/extract.py`, never to disable the check.
- **Shared CSS is global.** `shared/base.css` styles `body`, `h1`–`h3`, `a`, `table`, and more. If the existing site has its own stylesheet, load `base.css` only on these post pages, or scope it, rather than site-wide.
- **Theme:** `shared/theme-init.js` sets `data-theme` on `<html>` from `localStorage["site-theme"]` (light by default); `shared/theme.js` wires the toggle button. If the site already has a theme switch, map it to the same attribute (`data-theme="light|dark"`) and drop these two files.
- **`dist/periodic-weak-spots.html`** is a self-contained copy for sharing, not for hosting. It is gitignored.
- **Checks:** `tools/smoke.html` drives every interactive control and reports errors and overflow (see README → Checks). Run it at 1280 and 375 widths after integration.
