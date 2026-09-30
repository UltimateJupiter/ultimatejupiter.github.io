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
featured: true      # optional, shows a figure card under "Selected work"
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
slides: https://...       # optional
video: https://...        # optional
image: ./featured.jpg     # optional, shown as a hover preview
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

- Type: Newsreader (text) + IBM Plex Mono (labels), self-hosted via Fontsource.
- Colours are CSS variables at the top of `src/styles/global.css` (light + dark).
- The hero figure (`src/scripts/landscape.ts`) draws level sets of a slowly drifting sum of
  Gaussians with marching squares, plus a few heavy-ball SGD particles; the pointer carves a basin.
  It pauses off-screen and renders a static frame under `prefers-reduced-motion`.
- The nav mark is a wireframe icosahedron (`src/scripts/mark.ts`).
