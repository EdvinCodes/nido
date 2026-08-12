'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { chartColors } from './tokens';

export type SparklinePoint = { label: string; value: number };

/** Compact decorative trend — no ChartShell table toggle (safe inside links). */
export function Sparkline({
  data,
  loading,
  title,
  tone = 'neutral',
}: {
  data: SparklinePoint[];
  loading?: boolean;
  title: string;
  tone?: 'income' | 'expense' | 'neutral';
}) {
  const stroke =
    tone === 'income'
      ? chartColors.income
      : tone === 'expense'
        ? chartColors.expense
        : chartColors.primary;

  if (loading) {
    return <div className="h-10 w-full animate-pulse rounded-md bg-muted" aria-hidden />;
  }

  if (data.length === 0) {
    return <div className="h-10 w-full" aria-hidden />;
  }

  return (
    <div className="h-10 w-full" aria-hidden title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.15}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
