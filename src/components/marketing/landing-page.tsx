import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AssistantSection } from '@/components/marketing/assistant-section';
import { FeatureShowcase } from '@/components/marketing/feature-showcase';
import { LandingHero } from '@/components/marketing/landing-hero';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

const SOCIAL_KEYS = ['mit', 'selfHost', 'openSource', 'noTracking'] as const;
const PROBLEM_KEYS = ['spreadsheet', 'whoPaid', 'subscription'] as const;
const FEATURE_KEYS = ['splits', 'dashboard', 'budgets', 'balances'] as const;
const MODE_KEYS = ['solo', 'couple', 'flatshare'] as const;

const FEATURE_IMAGES: Record<(typeof FEATURE_KEYS)[number], string> = {
  splits: '/screenshots/marketing/splits.png',
  dashboard: '/screenshots/marketing/dashboard.png',
  budgets: '/screenshots/marketing/budgets.png',
  balances: '/screenshots/marketing/balances.png',
};

export async function LandingPage() {
  const t = await getTranslations('marketing');

  const featureRows = FEATURE_KEYS.map((key) => ({
    key,
    title: t(`features.items.${key}.title`),
    body: t(`features.items.${key}.body`),
    imageSrc: FEATURE_IMAGES[key],
    imageAlt: t(`features.items.${key}.imageAlt`),
  }));

  return (
    <>
      <LandingHero
        brand={t('brand')}
        headline={t('headline')}
        subhead={t('subhead')}
        ctaApp={t('ctaApp')}
        ctaGithub={t('ctaGithub')}
        previewTitle={t('preview.windowTitle')}
        previewAlt={t('preview.imageAlt')}
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
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl tracking-tight text-balance sm:text-5xl">
              {t('problem.title')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t('problem.subtitle')}</p>
          </div>
        </ScrollReveal>
        <ul className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {PROBLEM_KEYS.map((key, index) => (
            <li key={key} className="text-left">
              <ScrollReveal delayMs={index * 40}>
                <span className="font-mono text-xs tracking-widest text-primary uppercase">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-lg font-medium tracking-tight">
                  {t(`problem.cards.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`problem.cards.${key}.body`)}
                </p>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border/70 bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <h2 className="text-center font-display text-4xl tracking-tight sm:text-5xl">
              {t('features.title')}
            </h2>
          </ScrollReveal>
          <FeatureShowcase rows={featureRows} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <ScrollReveal>
          <h2 className="text-center font-display text-4xl tracking-tight sm:text-5xl">
            {t('modes.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t('modes.subtitle')}
          </p>
        </ScrollReveal>
        <ul className="mt-16 divide-y divide-border border-y border-border">
          {MODE_KEYS.map((key, index) => (
            <li key={key}>
              <ScrollReveal delayMs={index * 40}>
                <div className="grid gap-3 py-8 md:grid-cols-[8rem_1fr_1.4fr] md:items-baseline md:gap-8">
                  <span className="text-sm font-medium tracking-wide text-primary uppercase">
                    {t(`modes.items.${key}.label`)}
                  </span>
                  <h3 className="font-display text-2xl tracking-tight">
                    {t(`modes.items.${key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    {t(`modes.items.${key}.body`)}
                  </p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </section>

      <AssistantSection
        title={t('assistant.title')}
        subtitle={t('assistant.subtitle')}
        badge={t('assistant.badge')}
        question={t('assistant.question')}
        answer={t('assistant.answer')}
        footnote={t('assistant.footnote')}
      />

      <section className="border-y border-border/70">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              {t('privacy.title')}
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">{t('privacy.body')}</p>
          </div>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <ScrollReveal>
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
              <p className="mt-6">
                <Link
                  href={route('/docs')}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('openSource.docsLink')}
                </Link>
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border bg-surface-raised/80 p-5 text-left font-mono text-xs leading-relaxed text-muted-foreground">
              <code>{t('openSource.snippet')}</code>
            </pre>
          </div>
        </ScrollReveal>
      </section>

      <section className="relative overflow-hidden border-t border-border">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_120%,oklch(0.78_0.14_72_/_0.18),transparent_60%)]"
          aria-hidden
        />
        <ScrollReveal>
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-20 text-center lg:py-28">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              {t('finalCta.title')}
            </h2>
            <p className="text-muted-foreground">{t('finalCta.body')}</p>
            <Button size="lg" asChild>
              <Link href={route('/sign-up')}>{t('ctaApp')}</Link>
            </Button>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
