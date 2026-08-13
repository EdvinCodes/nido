import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { locales } from '@/i18n/locales';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  const locale = await getLocale();

  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    metadataBase: new URL(appUrl),
    alternates: {
      canonical: '/',
      languages: {
        'x-default': '/',
        ...Object.fromEntries(locales.map((loc) => [loc, '/'])),
      },
    },
    openGraph: {
      type: 'website',
      locale,
      siteName: 'Nido',
      title: t('title'),
      description: t('description'),
    },
  };
}

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('metadata');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Nido',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description: t('description'),
    url: appUrl,
    license: 'https://opensource.org/licenses/MIT',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
        <MarketingHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <MarketingFooter />
      </div>
    </>
  );
}
