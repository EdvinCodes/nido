import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { NidoLogo } from '@/components/marketing/nido-logo';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-full flex-1">
      <main className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <NidoLogo />
          </Link>
          {children}
        </div>
      </main>
      <aside
        className="relative hidden overflow-hidden border-l border-border lg:flex lg:w-1/2 lg:flex-col lg:justify-end lg:p-14"
        aria-hidden
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_70%_10%,oklch(0.78_0.14_72_/_0.22),transparent_55%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative max-w-md space-y-4">
          <p className="font-display text-5xl tracking-tight text-foreground">nido</p>
          <h2 className="text-xl font-medium tracking-tight text-balance">{t('panelTitle')}</h2>
          <p className="text-muted-foreground">{t('panelBody')}</p>
        </div>
      </aside>
    </div>
  );
}
