'use client';

import { Amount } from '@/components/money/amount';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMoney, money } from '@/lib/money';
import { cn } from '@/lib/utils';

export type ConvertedAmountProps = {
  /** Amount in the space base currency (minor units). */
  baseMinor: number;
  baseCurrency: string;
  /** Original transaction amount. */
  originalMinor: number;
  originalCurrency: string;
  baseRate: number;
  rateAsOf?: string | null;
  manual?: boolean;
  locale?: string;
  className?: string;
  tone?: 'expense' | 'income' | 'transfer' | 'none';
};

/**
 * Renders a base-currency amount with ≈ when converted from another currency.
 */
export function ConvertedAmount({
  baseMinor,
  baseCurrency,
  originalMinor,
  originalCurrency,
  baseRate,
  rateAsOf,
  manual = false,
  locale,
  className,
  tone = 'none',
}: ConvertedAmountProps) {
  const converted = originalCurrency !== baseCurrency;

  const body = (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {converted ? <span className="text-muted-foreground">≈</span> : null}
      <Amount
        minor={baseMinor}
        currency={baseCurrency}
        tone={tone}
        {...(locale ? { locale } : {})}
      />
      {manual ? (
        <span className="text-[10px] tracking-wide text-amber-600 uppercase dark:text-amber-400">
          *
        </span>
      ) : null}
    </span>
  );

  if (!converted) return body;

  const original = formatMoney(money(BigInt(originalMinor), originalCurrency), {
    ...(locale ? { locale } : {}),
  });
  const tip = manual
    ? `${original} · manual rate ${baseRate}`
    : `${original} · ${baseRate} · ${rateAsOf ?? '—'}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{body}</span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
