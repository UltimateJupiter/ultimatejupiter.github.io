# ultimatejupiter.github.io

Personal site of Xingyu Zhu, built with [Astro](https://astro.build). Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

## Adding things

Everything is a file; nothing needs to be edited in the page templates. The build fails with a
clear message if a required field is missing or misspelled (see `src/content.config.ts`).

### A paper

Create `src/content/publications/<slug>/index.md` (the folder name becomes the URL,
`/publications/<slug>/`). Optionally add `cite.bib` and a figure next to it.

```yaml
---
title: My New Paper
authors:            # "*" marks equal contribution; your own name is bolded automatically
- Xingyu Zhu*
- Coauthor Name*
- Sanjeev Arora
date: '2026-10-01'
venue: NeurIPS 2026
award: Oral         # optional, shown as a small tag
featured: true      # optional; kept for your own bookkeeping (any paper with an image shows it)
image: ./featured.png
caption: One-line description of the figure.
links:
- name: arXiv
  url: https://arxiv.org/abs/xxxx.xxxxx
- name: Code
  url: https://github.com/...
abstract: >
  Plain text. Inline math like $2/\eta$ is typeset with KaTeX.
---
```

Papers are grouped by year automatically. `cite.bib` is cleaned up (abstract, keywords etc. are
stripped) for the BibTeX panel.

### A talk

`src/content/talks/<slug>/index.md`:

```yaml
---
title: Talk Title
event: Seminar Name
event_url: https://...    # optional
date: '2026-10-01'
location: Princeton, NJ   # optional
slides: /uploads/my-talk.pdf   # optional; a PDF in public/ opens in the inline slide viewer,
                               # any other URL is a plain link
video: https://...             # optional; bilibili, YouTube and Princeton Media Central links
                               # play inline on the site
video_lang: Chinese            # optional; shown as "Video (in Chinese)"
                               # On /talks/ each talk opens its video by default, or its slides if
                               # there is no video. On the home page they stay closed until clicked.
---
```

### A news item

`src/content/news/YYYY-MM-DD-short-name.md`:

```yaml
---
title: Paper accepted at ICML!
date: '2026-10-01'
summary: Optional one-liner shown under the headline.
link: https://...   # optional; where the headline points
---
Optional body. If present, the headline links to its own page instead.
```

### Bio, links, education, CV

`src/data/profile.ts`. Replace the CV at `public/uploads/Xingyu_Zhu_CV_PhD.pdf`. How many items the
home page shows before linking to the full list is `homeLimits` in the same file.

## Design notes

- Type: STIX Two Text (reading text) + Instrument Sans (names, titles, labels), self-hosted via Fontsource.
- Colours are CSS variables at the top of `src/styles/global.css` (light + dark): near-black ink on pale
  grey paper, dark orange for actions, and an orange highlighter (`--mark`) for hover, the current page and awards.
- The hero shows one of the paper illustrations in `src/scripts/plates/` (one file per picture,
  captions and paper links in `meta.ts`). Each visit starts on the next one; "Next picture" steps
  through them, and each also heads its own paper page. They are drawn left to right once
  (instantly under `prefers-reduced-motion`), and pointing at one highlights part of it. On wide
  screens your name, bio and the picture's caption sit in a title block docked under it (`Hero.astro`).
  To add one: write a `Plate` (a `render` and a `pick`), list it in `meta.ts` and in `DRAW` in `index.ts`.
- The nav mark is the same fork as an inline SVG in `src/components/Nav.astro`. The interactive posts
  carry a static copy of the nav in `blog-interactive/src/shared/site-theme.css` and each `page.html`.
