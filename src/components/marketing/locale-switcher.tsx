'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { locales, LOCALE_COOKIE, type Locale } from '@/i18n/locales';
import { cn } from '@/lib/utils';

function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

export function MarketingLocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('settings');
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn('inline-flex rounded-md border border-border p-0.5', className)}
      role="group"
      aria-label={t('locale')}
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          disabled={pending || locale === loc}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium uppercase transition-colors',
            locale === loc
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => {
            if (locale === loc) return;
            startTransition(() => {
              setLocaleCookie(loc);
              window.location.reload();
            });
          }}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
