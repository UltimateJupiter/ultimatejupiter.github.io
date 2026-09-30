import { getCollection, type CollectionEntry } from 'astro:content';
import katex from 'katex';
import { profile } from '../data/profile';

export type Publication = CollectionEntry<'publications'>;
export type Talk = CollectionEntry<'talks'>;
export type News = CollectionEntry<'news'>;

const byDateDesc = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.valueOf() - a.data.date.valueOf();

export async function getPublications() {
  return (await getCollection('publications')).sort(byDateDesc);
}
export async function getTalks() {
  return (await getCollection('talks')).sort(byDateDesc);
}
export async function getNews() {
  return (await getCollection('news')).sort(byDateDesc);
}

export function groupByYear<T extends { data: { date: Date } }>(items: T[]) {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const y = item.data.date.getUTCFullYear();
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y)!.push(item);
  }
  return [...groups.entries()];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtMonth = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Author list as HTML: own name emphasised, "*" rendered as an equal-contribution mark. */
export function authorsHtml(authors: string[]) {
  return authors
    .map((raw) => {
      const equal = raw.trim().endsWith('*');
      const name = raw.replace(/\*+$/, '').trim();
      const me = profile.authorAliases.includes(name);
      let html = escapeHtml(name);
      if (me) html = `<span class="me">${html}</span>`;
      if (equal) html += '<sup class="eq" title="Equal contribution">*</sup>';
      return html;
    })
    .join(', ');
}

export const hasEqualContribution = (authors: string[]) => authors.some((a) => a.trim().endsWith('*'));

/** Escape text and typeset $...$ inline math with KaTeX at build time. */
export function mathHtml(text: string) {
  return text
    .replace(/``/g, '\u201c')
    .replace(/''/g, '\u201d')
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.startsWith('$') && part.endsWith('$') && part.length > 2
        ? katex.renderToString(part.slice(1, -1), { throwOnError: false })
        : escapeHtml(part),
    )
    .join('');
}

// ---- BibTeX -----------------------------------------------------------------

const bibFiles = import.meta.glob('/src/content/publications/*/cite.bib', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Reference-manager fields that only add noise to a copy-paste citation.
const DROP_FIELDS = new Set(['abstract', 'copyright', 'keywords', 'file', 'urldate', 'note', 'annote', 'shorttitle']);

export function getBibtex(id: string): string | undefined {
  const raw = bibFiles[`/src/content/publications/${id}/cite.bib`];
  return raw ? cleanBibtex(raw) : undefined;
}

function cleanBibtex(raw: string) {
  const src = raw.trim();
  const head = src.match(/^@\s*(\w+)\s*\{\s*([^,\s]+)\s*,/);
  if (!head) return src;
  const fields: [string, string][] = [];
  let i = head[0].length;
  while (i < src.length) {
    const m = /\s*([\w-]+)\s*=\s*/y;
    m.lastIndex = i;
    const f = m.exec(src);
    if (!f) break;
    i = m.lastIndex;
    let value = '';
    if (src[i] === '{') {
      let depth = 0;
      const start = i;
      for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) break;
      }
      value = src.slice(start + 1, i);
      i++;
    } else if (src[i] === '"') {
      const end = src.indexOf('"', i + 1);
      value = src.slice(i + 1, end);
      i = end + 1;
    } else {
      const end = src.slice(i).search(/[,}\n]/);
      value = src.slice(i, i + end).trim();
      i += end;
    }
    while (i < src.length && /[\s,]/.test(src[i])) i++;
    fields.push([f[1].toLowerCase(), value.replace(/\s+/g, ' ').trim()]);
  }
  const kept = fields.filter(([k]) => !DROP_FIELDS.has(k));
  const width = Math.max(...kept.map(([k]) => k.length));
  const body = kept.map(([k, v]) => `  ${k.padEnd(width)} = {${v}}`).join(',\n');
  return `@${head[1].toLowerCase()}{${head[2]},\n${body}\n}`;
}
