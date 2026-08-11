import fs from 'node:fs';
import path from 'node:path';

export type DocEntry = {
  slug: string;
  title: string;
  filePath: string;
};

const DOCS_ROOT = path.join(process.cwd(), 'docs');

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.md$/i, '');
  const withoutPrefix = base.replace(/^\d+-/, '');
  return withoutPrefix
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Lists top-level markdown docs (excludes phases/ and BACKLOG). */
export function listDocs(): DocEntry[] {
  const entries = fs.readdirSync(DOCS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => ({
      slug: entry.name.replace(/\.md$/i, '').toLowerCase(),
      title: titleFromFilename(entry.name),
      filePath: path.join(DOCS_ROOT, entry.name),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getDocBySlug(slug: string): { entry: DocEntry; content: string } | null {
  const normalized = slug.toLowerCase();
  const entry = listDocs().find((doc) => doc.slug === normalized);
  if (!entry) return null;
  const content = fs.readFileSync(entry.filePath, 'utf8');
  return { entry, content };
}

export function slugToDocPath(slugParts: string[] | undefined): string | null {
  if (!slugParts || slugParts.length === 0) return null;
  return slugParts.join('-').toLowerCase();
}
