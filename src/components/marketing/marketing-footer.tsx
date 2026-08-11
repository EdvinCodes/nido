import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NidoLogo } from '@/components/marketing/nido-logo';
import { route } from '@/lib/routes';

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');
  const year = new Date().getFullYear();

  const internalLinks = [
    { href: route('/sign-in'), label: t('signIn') },
    { href: route('/docs'), label: t('docs') },
    { href: route('/privacy'), label: t('privacy') },
    { href: route('/changelog'), label: t('changelog') },
    { href: route('/brand'), label: t('brand') },
  ] as const;

  return (
    <footer className="border-t border-border bg-surface-raised/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <NidoLogo variant="mark" />
        <p className="max-w-md text-sm text-muted-foreground">{t('tagline')}</p>
        <nav aria-label={t('navLabel')} className="flex flex-wrap gap-4 text-sm">
          {internalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/EdvinCodes/nido"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
      <p className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        {t('copyright', { year })}
      </p>
    </footer>
  );
}
