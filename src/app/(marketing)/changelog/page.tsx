import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getChangelog } from '@/lib/marketing/changelog';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.pages.changelog');
  return { title: t('title'), description: t('description') };
}

export default async function ChangelogPage() {
  const t = await getTranslations('marketing.pages.changelog');
  const changelog = getChangelog();
  const subtitle = changelog.source === 'commits' ? t('fromCommits') : t('subtitle');

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl tracking-tight">{t('title')}</h1>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
      {changelog.entries.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ol className="mt-10 space-y-8">
          {changelog.entries.map((entry) => (
            <li key={entry.tag} className="border-b border-border pb-8">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-sm text-primary">{entry.tag}</span>
                {entry.date ? (
                  <time dateTime={entry.date} className="text-xs text-muted-foreground">
                    {entry.date}
                  </time>
                ) : null}
              </div>
              <p className="mt-2 text-foreground">{entry.message}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
