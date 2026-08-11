'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ProgressBar } from '@/components/ui/progress-bar';
import type { StorageUsage } from '@/features/attachments/queries';

function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit] ?? 'B'}`;
}

export function StorageSettings({ usage }: { usage: StorageUsage }) {
  const t = useTranslations('attachments.storage');
  const locale = useLocale();
  const ratio = usage.limitBytes > 0 ? Math.min(1, usage.bytes / usage.limitBytes) : 0;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-medium">{formatBytes(usage.bytes, locale)}</p>
            <p className="text-sm text-muted-foreground">
              {t('ofLimit', { limit: formatBytes(usage.limitBytes, locale) })}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{t('fileCount', { count: usage.count })}</p>
        </div>
        <ProgressBar className="mt-4" value={ratio} label={t('title')} />
        <p className="mt-2 text-xs text-muted-foreground">{t('freeTierNote')}</p>
      </div>
    </div>
  );
}
