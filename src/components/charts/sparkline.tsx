'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ChartShell } from './chart-shell';
import { chartColors } from './tokens';

export type SparklinePoint = { label: string; value: number };

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

  return (
    <ChartShell
      title={title}
      heightClassName="h-10"
      loading={loading}
      empty={data.length === 0}
      columns={[
        { key: 'label', label: 'Period' },
        { key: 'value', label: 'Value', align: 'right' },
      ]}
      rows={data.map((point) => ({
        label: point.label,
        value: String(point.value),
      }))}
    >
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
    </ChartShell>
  );
}
