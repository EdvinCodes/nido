'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="max-w-md text-balance text-muted-foreground">{t('description')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={() => {
            reset();
          }}
        >
          {tCommon('retry')}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">{tCommon('goHome')}</Link>
        </Button>
      </div>
    </main>
  );
}
