# Site

Static research posts with interactive figures, served by GitHub Pages. No frameworks and no npm: plain HTML, CSS, and JavaScript, assembled by one Python script.

## Layout

```
src/
  index.html                 site home (list of posts)
  shared/                    reusable across posts
    base.css                 color tokens (light + dark), typography, paper header, theorem boxes,
                             wrapping equations, citations, contents rail, illustration controls
    fx.css                   data-figure frame: toolbars, panels, tooltips, status line
    select.js, select.css    custom menu: upgrades any <select class="fx-select"> inside <figure class="fx">
    theme-init.js            in <head>: light by default, dark if the reader chose it
    theme.js                 the ◐ toggle (<button id="theme-btn"><span class="t"></span>)
    toc.js                   contents rail that highlights the section in view
    mathjax-config.js        MathJax settings
    fonts.css, fonts/        self-hosted Source Sans 3 and IBM Plex Mono
    vendor/mathjax/          MathJax 3.2.2 (tex-svg) and the boldsymbol extension
    FIGURES.md               conventions for writing a data figure
  posts/<slug>/
    page.html                the post; <!--FX:name--> marks where a data figure goes
    post.css, *.js           post-specific styles and scripts
    figs/<name>.{html,css,js}  one data figure each
    data.js                  figure data (window.FIGDATA)
    data-src/                how data.js is made (not published)
docs/                        build output that GitHub Pages serves (commit it)
dist/                        self-contained single-file copies of each post (not committed)
tools/                       headless-Chrome checks
build.py
```

## Build

```
python3 build.py                 # every post
python3 build.py periodic-weak-spots
```

This writes `docs/` (the website) and `dist/<slug>.html` (one file with fonts, MathJax, and data inlined, for email or offline use). The build refuses to finish if any output contains an internal training-data tag.

Preview locally with `python3 -m http.server 8000 --directory docs` and open http://localhost:8000.

## Publish on GitHub Pages

1. Put this folder in a GitHub repository (or copy it into your existing Pages repository).
2. Run `python3 build.py` and commit, including `docs/`.
3. Repository Settings → Pages → Build and deployment → Deploy from a branch → `main`, folder `/docs`.

The post is then at `https://<user>.github.io/<repo>/periodic-weak-spots/`. All links are relative, so the site also works under a project path or a custom domain.

If you already have a site: copy `docs/shared/` and `docs/periodic-weak-spots/` into it next to each other, since the post loads `../shared/`.

## Add a post

1. Copy `src/posts/periodic-weak-spots/page.html` to `src/posts/<new-slug>/page.html` as a template, and keep the `<head>` links and the scripts at the end that you need.
2. Write the content. Use `<div class="thm">` for boxed statements, `<div class="math-block eqwrap"><span class="eq">\(\displaystyle …\)</span>…</div>` for equations that wrap on narrow screens, and `<nav class="toc">` for the contents rail.
3. For an interactive figure, add `figs/<name>.html|css|js` and put `<!--FX:<name>-->` in the page (see `src/shared/FIGURES.md`).
4. Add the post to `src/index.html`, then build.

## Regenerate the figure data (Periodic Weak Spots)

```
python3 src/posts/periodic-weak-spots/data-src/extract.py /path/to/paper_figure_statistics.json
```

The raw export stays outside the repository. The concentration plane (Figure 4) comes from `data-src/conc/*.json`, digitized from the paper's vector figures by `data-src/conc/extract_*.py`.

## Checks

With a server at the site root (`python3 -m http.server 8766`):

```
python3 tools/shot.py "http://localhost:8766/tools/smoke.html?src=/docs/periodic-weak-spots/&w=375" out.png --wait 14
```

`smoke.html` drives every control and reports errors and horizontal overflow. `harness.html?f=<name>&post=<slug>` shows one figure alone (reads straight from `src/`, no build needed). `pageshot.html` screenshots the page scrolled to an element (`&el=<id>`, `&theme=dark`, `&sizes=1`). `pagetext.py` prints the page as plain text for proofreading.
