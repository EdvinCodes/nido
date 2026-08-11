import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.pages.privacy');
  return { title: t('title'), description: t('description') };
}

export default async function PrivacyPage() {
  const t = await getTranslations('marketing.pages.privacy');

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl tracking-tight">{t('title')}</h1>
      <div className="mt-8 space-y-4 text-muted-foreground">
        <p>{t('p1')}</p>
        <p>{t('p2')}</p>
        <p>{t('p3')}</p>
        <p>{t('p4')}</p>
      </div>
    </div>
  );
}
