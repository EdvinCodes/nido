import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { ProductPreview } from '@/components/marketing/product-preview';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

const SOCIAL_KEYS = ['mit', 'selfHost', 'openSource', 'noTracking'] as const;
const PROBLEM_KEYS = ['spreadsheet', 'whoPaid', 'subscription'] as const;
const FEATURE_KEYS = ['splits', 'ledger', 'budgets', 'balances'] as const;
const MODE_KEYS = ['solo', 'couple', 'flatshare'] as const;

export async function LandingPage() {
  const t = await getTranslations('marketing');

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.68_0.145_68_/_0.18),transparent)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div className="flex flex-col gap-6 text-center lg:text-left">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-display-md text-balance">{t('headline')}</h1>
            <p className="max-w-xl text-lg text-balance text-muted-foreground lg:max-w-none">
              {t('subhead')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Button size="lg" asChild>
                <Link href={route('/sign-up')}>{t('ctaApp')}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="https://github.com/EdvinCodes/nido" rel="noopener noreferrer">
                  {t('ctaGithub')}
                </a>
              </Button>
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b border-border bg-surface-raised/30">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-6 text-sm text-muted-foreground">
          {SOCIAL_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {t(`socialProof.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl tracking-tight">{t('problem.title')}</h2>
          <p className="mt-3 text-muted-foreground">{t('problem.subtitle')}</p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {PROBLEM_KEYS.map((key) => (
            <li key={key} className="rounded-xl border border-border bg-surface p-6 shadow-raised">
              <h3 className="font-medium">{t(`problem.cards.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`problem.cards.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-surface-raised/20">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <h2 className="text-center font-display text-3xl tracking-tight">
            {t('features.title')}
          </h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => (
              <li key={key} className="rounded-xl border border-border bg-background p-6">
                <h3 className="font-medium">{t(`features.items.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`features.items.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Modes */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <h2 className="text-center font-display text-3xl tracking-tight">{t('modes.title')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          {t('modes.subtitle')}
        </p>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {MODE_KEYS.map((key) => (
            <li key={key} className="flex flex-col rounded-xl border border-border bg-surface p-6">
              <span className="text-sm font-medium text-primary">
                {t(`modes.items.${key}.label`)}
              </span>
              <h3 className="mt-2 font-display text-xl">{t(`modes.items.${key}.title`)}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {t(`modes.items.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Privacy */}
      <section className="border-y border-border bg-surface-raised/30">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center lg:py-20">
          <h2 className="font-display text-3xl tracking-tight">{t('privacy.title')}</h2>
          <p className="mt-4 text-muted-foreground">{t('privacy.body')}</p>
        </div>
      </section>

      {/* Open source */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl tracking-tight">{t('openSource.title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('openSource.body')}</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {(['next', 'supabase', 'tailwind'] as const).map((key) => (
                <li key={key} className="rounded-full border border-border bg-surface px-3 py-1">
                  {t(`openSource.stack.${key}`)}
                </li>
              ))}
            </ul>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-border bg-surface-raised p-4 text-left font-mono text-xs leading-relaxed text-muted-foreground">
            <code>{t('openSource.snippet')}</code>
          </pre>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-gradient-to-b from-primary/10 to-transparent">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-16 text-center lg:py-20">
          <h2 className="font-display text-3xl tracking-tight">{t('finalCta.title')}</h2>
          <p className="text-muted-foreground">{t('finalCta.body')}</p>
          <Button size="lg" asChild>
            <Link href={route('/sign-up')}>{t('ctaApp')}</Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
