'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { route } from '@/lib/routes';

export function BankingSettings({ enabled, spaceId }: { enabled: boolean; spaceId: string }) {
  const t = useTranslations('import.banking');

  if (enabled) {
    return (
      <div className="space-y-6 p-4 lg:p-8">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('enabledDescription')}</p>
        <Button asChild>
          <Link href="#connect">{t('connect')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('disabledDescription')}</p>
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">{t('howToEnable')}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>{t('enableStep1')}</li>
          <li>{t('enableStep2')}</li>
          <li>{t('enableStep3')}</li>
        </ol>
      </div>
      <p className="text-sm text-muted-foreground">{t('csvFallback')}</p>
      <Button asChild variant="outline">
        <Link href={route(`/s/${spaceId}/import`)}>{t('goImport')}</Link>
      </Button>
    </div>
  );
}
