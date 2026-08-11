'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCY_LIST } from '@/lib/money/currencies';

export function CurrencySelect({
  value,
  onValueChange,
  baseCurrency,
  recentCurrencies,
  disabled,
  className,
}: {
  value: string;
  onValueChange: (code: string) => void;
  baseCurrency: string;
  recentCurrencies: string[];
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations('currency');

  const recent = useMemo(() => {
    const codes = new Set<string>([
      baseCurrency,
      ...recentCurrencies.filter((c) => c !== baseCurrency),
    ]);
    return [...codes].slice(0, 6);
  }, [baseCurrency, recentCurrencies]);

  const rest = CURRENCY_LIST.filter((c) => !recent.includes(c.code));

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled ?? false}>
      <SelectTrigger className={className} aria-label={t('selectLabel')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t('pinned')}</SelectLabel>
          {recent.map((code) => {
            const info = CURRENCY_LIST.find((c) => c.code === code);
            return (
              <SelectItem key={code} value={code}>
                {code}
                {info ? ` · ${info.symbol}` : ''}
                {code === baseCurrency ? ` (${t('base')})` : ''}
              </SelectItem>
            );
          })}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>{t('all')}</SelectLabel>
          {rest.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.code} · {c.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
