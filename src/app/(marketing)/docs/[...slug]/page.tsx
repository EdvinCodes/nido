import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsShell } from '@/components/marketing/docs-shell';
import { getDocBySlug, listDocs, slugToDocPath } from '@/lib/marketing/docs';
import { renderMarkdown } from '@/lib/marketing/render-markdown';

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export function generateStaticParams() {
  return listDocs().map((doc) => ({ slug: [doc.slug] }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const docSlug = slugToDocPath(slug);
  if (!docSlug) return {};
  const doc = getDocBySlug(docSlug);
  if (!doc) return {};
  return { title: doc.entry.title, description: doc.entry.title };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const docSlug = slugToDocPath(slug);
  if (!docSlug) notFound();

  const doc = getDocBySlug(docSlug);
  if (!doc) notFound();

  const docs = listDocs();

  return (
    <DocsShell docs={docs} activeSlug={docSlug}>
      <div className="prose-nido">{renderMarkdown(doc.content)}</div>
    </DocsShell>
  );
}
