import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LandingHero } from '@/components/marketing/landing-hero';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
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

      <LandingHero
        brand={t('brand')}
        headline={t('headline')}
        subhead={t('subhead')}
        ctaApp={t('ctaApp')}
        ctaGithub={t('ctaGithub')}
        preview={{
          windowTitle: t('preview.windowTitle'),
          dayLabel: t('preview.dayLabel'),
          rows: [
            {
              cat: 'G',
              name: t('preview.row1'),
              sub: t('preview.row1Sub'),
              amount: '−42,50 €',
              tone: 'expense',
            },
            {
              cat: 'T',
              name: t('preview.row2'),
              sub: t('preview.row2Sub'),
              amount: '−18,00 €',
              tone: 'expense',
            },
            {
              cat: '↑',
              name: t('preview.row3'),
              sub: t('preview.row3Sub'),
              amount: '+2.850,00 €',
              tone: 'income',
            },
          ],
        }}
      />

      <section className="border-y border-border/70">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5 text-sm text-muted-foreground">
          {SOCIAL_KEYS.map((key) => (
            <li key={key} className="tracking-wide">
              {t(`socialProof.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl tracking-tight text-balance sm:text-5xl">
            {t('problem.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('problem.subtitle')}</p>
        </div>
        <ul className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {PROBLEM_KEYS.map((key, index) => (
            <li key={key} className="text-left">
              <span className="font-mono text-xs tracking-widest text-primary uppercase">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 text-lg font-medium tracking-tight">
                {t(`problem.cards.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`problem.cards.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border/70 bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <h2 className="text-center font-display text-4xl tracking-tight sm:text-5xl">
            {t('features.title')}
          </h2>
          <ul className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => (
              <li key={key} className="max-w-md">
                <h3 className="text-lg font-medium tracking-tight">
                  {t(`features.items.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`features.items.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <h2 className="text-center font-display text-4xl tracking-tight sm:text-5xl">
          {t('modes.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          {t('modes.subtitle')}
        </p>
        <ul className="mt-16 divide-y divide-border border-y border-border">
          {MODE_KEYS.map((key) => (
            <li
              key={key}
              className="grid gap-3 py-8 md:grid-cols-[8rem_1fr_1.4fr] md:items-baseline md:gap-8"
            >
              <span className="text-sm font-medium tracking-wide text-primary uppercase">
                {t(`modes.items.${key}.label`)}
              </span>
              <h3 className="font-display text-2xl tracking-tight">
                {t(`modes.items.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {t(`modes.items.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border/70">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">{t('privacy.title')}</h2>
          <p className="mt-5 text-lg text-muted-foreground">{t('privacy.body')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              {t('openSource.title')}
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">{t('openSource.body')}</p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {(['next', 'supabase', 'tailwind'] as const).map((key) => (
                <li key={key}>{t(`openSource.stack.${key}`)}</li>
              ))}
            </ul>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-border bg-surface-raised/80 p-5 text-left font-mono text-xs leading-relaxed text-muted-foreground">
            <code>{t('openSource.snippet')}</code>
          </pre>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_120%,oklch(0.78_0.14_72_/_0.18),transparent_60%)]"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-20 text-center lg:py-28">
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
            {t('finalCta.title')}
          </h2>
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
