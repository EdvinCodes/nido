import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MarketingLocaleSwitcher } from '@/components/marketing/locale-switcher';
import { NidoLogo } from '@/components/marketing/nido-logo';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

export async function MarketingHeader() {
  const t = await getTranslations('marketing');

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="rounded-md bg-background/40 px-2 py-1 backdrop-blur-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <NidoLogo className="[&_span]:text-lg" />
        </Link>
        <nav
          className="flex items-center gap-1 rounded-full border border-border/50 bg-background/55 p-1 shadow-raised backdrop-blur-md sm:gap-2 sm:px-1.5"
          aria-label={t('navLabel')}
        >
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
