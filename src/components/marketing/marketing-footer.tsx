import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NidoLogo } from '@/components/marketing/nido-logo';
import { route } from '@/lib/routes';

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-raised/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <NidoLogo variant="mark" />
        <p className="max-w-md text-sm text-muted-foreground">{t('tagline')}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href={route('/sign-in')} className="text-muted-foreground hover:text-foreground">
            {t('signIn')}
          </Link>
          <a
            href="https://github.com/EdvinCodes/nido"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </div>
      <p className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        {t('copyright', { year })}
      </p>
    </footer>
  );
}
