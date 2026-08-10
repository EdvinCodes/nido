'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartShell } from './chart-shell';
import { chartAxisStyle, chartColors, chartTooltipStyle } from './tokens';

export type StackedBarsPoint = {
  label: string;
  [seriesKey: string]: string | number;
};

export function StackedBars({
  data,
  series,
  loading,
  title,
  valueFormatter,
}: {
  data: StackedBarsPoint[];
  series: Array<{ key: string; label: string; color: string }>;
  loading?: boolean;
  title: string;
  valueFormatter: (value: number) => string;
}) {
  return (
    <ChartShell
      title={title}
      loading={loading}
      empty={data.length === 0 || series.length === 0}
      columns={[
        { key: 'label', label: 'Period' },
        ...series.map((item) => ({
          key: item.key,
          label: item.label,
          align: 'right' as const,
        })),
      ]}
      rows={data.map((point) => {
        const row: Record<string, string> = {
          label: typeof point.label === 'string' ? point.label : String(point.label),
        };
        for (const item of series) {
          row[item.key] = valueFormatter(Number(point[item.key] ?? 0));
        }
        return row;
      })}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.border} strokeOpacity={0.5} />
          <XAxis dataKey="label" tick={chartAxisStyle} axisLine={false} tickLine={false} />
          <YAxis
            tick={chartAxisStyle}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(value: number) => valueFormatter(value)}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value) => valueFormatter(Number(value ?? 0))}
          />
          <Legend />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="stack"
              fill={item.color}
              isAnimationActive
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
