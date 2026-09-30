import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import fs from 'node:fs';
import path from 'node:path';

// In `astro dev`, serve public/<dir>/index.html for /<dir>/ (static hosts such as GitHub Pages
// already do this). Needed for standalone pages like public/blog/<post>/.
const publicDirIndex = {
  name: 'public-dir-index',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url?.split('?')[0] ?? '';
      if (url.endsWith('/') && fs.existsSync(path.join(server.config.publicDir, decodeURIComponent(url), 'index.html'))) {
        req.url = url + 'index.html';
      }
      next();
    });
  },
};

export default defineConfig({
  site: 'https://ultimatejupiter.github.io',
  integrations: [sitemap()],
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  vite: { plugins: [publicDirIndex] },
  markdown: {
    // $inline$ and $$display$$ math in blog posts / news
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      // both themes are emitted as CSS variables; prose.css picks one per colour scheme
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
    },
  },
});
