import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrendDeltaProps = {
  /** Relative change as a ratio (0.12 = +12%). Null when undefined. */
  ratio: number | null;
  /** Whether an increase is desirable (income/net) or not (expense). */
  goodWhenUp?: boolean;
  label: string;
  className?: string;
};

export function TrendDelta({ ratio, goodWhenUp = true, label, className }: TrendDeltaProps) {
  if (ratio == null || !Number.isFinite(ratio)) {
    return (
      <span
        className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}
      >
        <Minus className="size-3" aria-hidden />
        <span>{label}</span>
      </span>
    );
  }

  const up = ratio > 0;
  const flat = Math.abs(ratio) < 0.0005;
  const good = flat ? null : up === goodWhenUp;
  const pct = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(ratio);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        flat && 'text-muted-foreground',
        good === true && 'text-income',
        good === false && 'text-expense',
        className,
      )}
    >
      {flat ? (
        <Minus className="size-3" aria-hidden />
      ) : up ? (
        <ArrowUpRight className="size-3" aria-hidden />
      ) : (
        <ArrowDownRight className="size-3" aria-hidden />
      )}
      <span>
        {pct} {label}
      </span>
    </span>
  );
}
