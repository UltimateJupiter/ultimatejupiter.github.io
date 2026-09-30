import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Folder name becomes the id, e.g. publications/zhu-power-2025/index.md -> "zhu-power-2025".
const folderId = ({ entry }: { entry: string }) => entry.replace(/\/index\.mdx?$/, '');

// Absolute URLs, or site-relative paths such as /blog/<post>/
const link = z.object({ name: z.string(), url: z.string().regex(/^(https?:\/\/|\/)/, 'absolute URL or /path') });

const publications = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/publications', generateId: folderId }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Append "*" to a name to mark equal contribution.
      authors: z.array(z.string()),
      date: z.coerce.date(),
      venue: z.string(),
      // Short highlight shown next to the venue, e.g. "Spotlight", "Oral".
      award: z.string().optional(),
      // Featured papers get a card with their figure on the home page.
      featured: z.boolean().default(false),
      image: image().optional(),
      caption: z.string().optional(),
      links: z.array(link).default([]),
      abstract: z.string().default(''),
    }),
});

const talks = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/talks', generateId: folderId }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      event: z.string(),
      event_url: z.string().url().optional(),
      date: z.coerce.date(),
      location: z.string().optional(),
      slides: z.string().url().optional(),
      video: z.string().url().optional(),
      image: image().optional(),
    }),
});

const news = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string().optional(),
    // Optional external link for the headline (otherwise a page is made if the entry has a body).
    link: z.string().url().optional(),
  }),
});

// Blog posts: either `blog/<slug>.md` or, when a post has images, `blog/<slug>/index.md`.
const blog = defineCollection({
  loader: glob({
    pattern: ['*.md', '*/index.md'],
    base: './src/content/blog',
    generateId: ({ entry }) => entry.replace(/(\/index)?\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    // One or two sentences shown in listings, RSS and link previews.
    description: z.string(),
    tags: z.array(z.string()).default([]),
    // Drafts are visible in `npm run dev` only.
    draft: z.boolean().default(false),
    // For a standalone page (e.g. an interactive post built by blog-interactive/), where the
    // listing should link instead of rendering this entry's Markdown body.
    href: z.string().optional(),
  }),
});

export const collections = { publications, talks, news, blog };
