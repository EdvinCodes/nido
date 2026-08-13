'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DocEntry } from '@/lib/marketing/docs';
import { route } from '@/lib/routes';

export function DocsShell({
  docs,
  activeSlug,
  children,
}: {
  docs: DocEntry[];
  activeSlug: string | null;
  children: ReactNode;
}) {
  const t = useTranslations('marketing.pages.docs');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => doc.title.toLowerCase().includes(q) || doc.slug.includes(q));
  }, [docs, query]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12 lg:flex-row lg:gap-12">
      <aside className="lg:w-64 lg:shrink-0">
        <label htmlFor="docs-search" className="sr-only">
          {t('searchLabel')}
        </label>
        <input
          id="docs-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder={t('searchPlaceholder')}
          className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <nav aria-label="Documentation">
          <ul className="space-y-1 text-sm">
            {filtered.map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={route(`/docs/${doc.slug}`)}
                  className={`block rounded-md px-2 py-1.5 ${
                    activeSlug === doc.slug
                      ? 'bg-surface-raised font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground'
                  }`}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <article className="min-w-0 flex-1">{children}</article>
    </div>
  );
}
