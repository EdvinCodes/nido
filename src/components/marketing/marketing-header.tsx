import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MarketingLocaleSwitcher } from '@/components/marketing/locale-switcher';
import { NidoLogo } from '@/components/marketing/nido-logo';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

export async function MarketingHeader() {
  const t = await getTranslations('marketing');

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <NidoLogo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label={t('navLabel')}>
          <MarketingLocaleSwitcher />
          <Button variant="ghost" size="sm" asChild>
            <Link href={route('/sign-in')}>{t('ctaSignIn')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={route('/sign-up')}>{t('ctaApp')}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
