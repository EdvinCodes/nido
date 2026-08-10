import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Placeholder landing page. Replaced by the real marketing site in Phase 11. */
export default async function MarketingPage() {
  const t = await getTranslations('marketing');
  const tCommon = await getTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        {tCommon('appName')}
      </p>
      <h1 className="max-w-2xl font-display text-display-md text-balance">{t('headline')}</h1>
      <p className="max-w-lg text-lg text-balance text-muted-foreground">{t('subhead')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/demo">{t('ctaApp')}</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://github.com/EdvinCodes/nido" rel="noopener noreferrer">
            {t('ctaGithub')}
          </a>
        </Button>
      </div>
    </main>
  );
}
