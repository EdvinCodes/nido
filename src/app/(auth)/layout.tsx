import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-full flex-1">
      <main className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-12">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
      <aside
        className="relative hidden overflow-hidden bg-gradient-to-br from-primary/20 via-background to-accent/30 lg:flex lg:w-1/2 lg:flex-col lg:justify-end lg:p-12"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.7_0.08_85_/0.25),transparent_55%)]" />
        <div className="relative max-w-md space-y-3">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Nido</p>
          <h2 className="font-display text-3xl text-balance">{t('panelTitle')}</h2>
          <p className="text-muted-foreground">{t('panelBody')}</p>
        </div>
      </aside>
      <Link href="/" className="sr-only">
        Home
      </Link>
    </div>
  );
}
