'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import { ChartShell } from './chart-shell';
import { chartAxisStyle, chartColors, chartTooltipStyle } from './tokens';

export type HorizontalBarPoint = {
  label: string;
  value: number;
  color?: string;
  href?: string;
};

export function HorizontalBars({
  data,
  loading,
  title,
  valueFormatter,
  onBarClick,
}: {
  data: HorizontalBarPoint[];
  loading?: boolean;
  title: string;
  valueFormatter: (value: number) => string;
  onBarClick?: (point: HorizontalBarPoint) => void;
}) {
  const t = useTranslations('charts.columns');
  return (
    <ChartShell
      title={title}
      heightClassName="h-72"
      loading={loading}
      empty={data.length === 0}
      columns={[
        { key: 'label', label: t('name') },
        { key: 'value', label: t('amount'), align: 'right' },
      ]}
      rows={data.map((point) => ({
        label: point.label,
        value: valueFormatter(point.value),
      }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <XAxis
            type="number"
            tick={chartAxisStyle}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => valueFormatter(value)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            tick={chartAxisStyle}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value) => valueFormatter(Number(value ?? 0))}
          />
          <Bar
            dataKey="value"
            fill={chartColors.primary}
            radius={[0, 6, 6, 0]}
            isAnimationActive
            cursor={onBarClick ? 'pointer' : undefined}
            onClick={(entry) => {
              const payload = (entry as { payload?: HorizontalBarPoint }).payload;
              if (payload) onBarClick?.(payload);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
