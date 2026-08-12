import Image from 'next/image';
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
        className="relative hidden overflow-hidden border-l border-border bg-surface lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:gap-10 lg:p-12 xl:p-14"
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

        <div className="relative space-y-3">
          <p className="font-display text-4xl tracking-tight text-foreground xl:text-5xl">nido</p>
          <h2 className="text-xl font-medium tracking-tight text-balance xl:text-2xl">
            {t('panelTitle')}
          </h2>
          <p className="max-w-md text-muted-foreground">{t('panelBody')}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {t('panelPoint1')}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {t('panelPoint2')}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {t('panelPoint3')}
            </li>
          </ul>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-surface/90 shadow-float">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5">
              <div className="flex gap-1.5" aria-hidden>
                <span className="size-2 rounded-full bg-expense/70" />
                <span className="size-2 rounded-full bg-warning/70" />
                <span className="size-2 rounded-full bg-income/70" />
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {t('panelPreviewLabel')}
              </span>
            </div>
            <div className="relative aspect-[16/10] w-full bg-surface">
              <Image
                src="/screenshots/marketing/dashboard.png"
                alt=""
                fill
                priority
                loading="eager"
                unoptimized
                sizes="(max-width: 1280px) 50vw, 640px"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
