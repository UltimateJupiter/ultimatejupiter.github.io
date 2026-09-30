import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, postUrl } from '../../lib/content';
import { profile } from '../../data/profile';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).filter((p) => !p.data.draft);
  return rss({
    title: `${profile.name} — Blog`,
    description: `Notes and essays by ${profile.name}.`,
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.description,
      link: postUrl(p),
      categories: p.data.tags,
    })),
  });
}
