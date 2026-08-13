import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NidoLogo } from '@/components/marketing/nido-logo';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.pages.brand');
  return { title: t('title'), description: t('description') };
}

const palette = [
  { nameKey: 'palette.primary', token: '--primary', className: 'bg-primary' },
  {
    nameKey: 'palette.background',
    token: '--background',
    className: 'bg-background border border-border',
  },
  { nameKey: 'palette.surface', token: '--surface', className: 'bg-surface border border-border' },
  { nameKey: 'palette.income', token: '--income', className: 'bg-income' },
  { nameKey: 'palette.expense', token: '--expense', className: 'bg-expense' },
  { nameKey: 'palette.warning', token: '--warning', className: 'bg-warning' },
] as const;

export default async function BrandPage() {
  const t = await getTranslations('marketing.pages.brand');

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl tracking-tight">{t('title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>

      <section className="mt-12">
        <h2 className="text-lg font-medium">{t('logoTitle')}</h2>
        <div className="mt-6 flex flex-wrap items-center gap-10 rounded-xl border border-border bg-surface p-8">
          <NidoLogo variant="lockup" />
          <NidoLogo variant="mark" />
          <NidoLogo variant="wordmark" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t('logoUsage')}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">{t('colorsTitle')}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {palette.map((swatch) => (
            <li
              key={swatch.token}
              className="flex items-center gap-4 rounded-lg border border-border p-4"
            >
              <span className={`size-10 shrink-0 rounded-md ${swatch.className}`} aria-hidden />
              <span>
                <span className="block text-sm font-medium">{t(swatch.nameKey)}</span>
                <span className="font-mono text-xs text-muted-foreground">{swatch.token}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">{t('typeTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('typeBody')}</p>
        <p className="mt-6 font-display text-5xl tracking-tight">nido</p>
        <p className="mt-4 text-base">{t('typeSample')}</p>
      </section>
    </div>
  );
}
