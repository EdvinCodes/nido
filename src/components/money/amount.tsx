import { money } from '@/lib/money/money';
import { formatMoneyOrDash, type FormatMoneyOptions } from '@/lib/money/format';
import { cn } from '@/lib/utils';

export type AmountProps = {
  /** Minor units. Pass null/undefined for the empty dash. */
  minor: bigint | number | null | undefined;
  currency: string;
  /** expense → expense colour, income → income colour, transfer → muted. */
  tone?: 'expense' | 'income' | 'transfer' | 'auto' | 'none';
  locale?: string;
  className?: string;
  formatOptions?: FormatMoneyOptions;
};

/**
 * The only place money is rendered. Tabular figures, optional directional colour.
 * See docs/03-DESIGN-SYSTEM.md §6.
 */
export function Amount({
  minor,
  currency,
  tone = 'none',
  locale,
  className,
  formatOptions,
}: AmountProps) {
  if (minor == null) {
    return <span className={cn('amount text-muted-foreground', className)}>—</span>;
  }

  const value = money(typeof minor === 'number' ? BigInt(minor) : minor, currency);
  const options: FormatMoneyOptions = { ...formatOptions };
  if (locale !== undefined) options.locale = locale;
  const formatted = formatMoneyOrDash(value, options);

  const toneClass =
    tone === 'expense'
      ? 'text-expense'
      : tone === 'income'
        ? 'text-income'
        : tone === 'transfer'
          ? 'text-muted-foreground'
          : '';

  return <span className={cn('amount tabular', toneClass, className)}>{formatted}</span>;
}

export function toneForKind(
  kind: 'expense' | 'income' | 'transfer',
): NonNullable<AmountProps['tone']> {
  return kind;
}
