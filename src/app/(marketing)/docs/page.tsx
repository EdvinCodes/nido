import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DocsShell } from '@/components/marketing/docs-shell';
import { listDocs } from '@/lib/marketing/docs';
import { route } from '@/lib/routes';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.pages.docs');
  return { title: t('title'), description: t('description') };
}

export default async function DocsIndexPage() {
  const t = await getTranslations('marketing.pages.docs');
  const docs = listDocs();

  return (
    <DocsShell docs={docs} activeSlug={null}>
      <h1 className="font-display text-4xl tracking-tight">{t('title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {docs.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={route(`/docs/${doc.slug}`)}
              className="block rounded-lg border border-border bg-surface px-4 py-3 text-sm hover:bg-surface-raised"
            >
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </DocsShell>
  );
}
