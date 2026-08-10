'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartShell } from './chart-shell';
import { chartAxisStyle, chartColors, chartTooltipStyle } from './tokens';

export type AreaTrendPoint = {
  label: string;
  value: number;
  previous?: number | undefined;
};

export function AreaTrend({
  data,
  loading,
  title,
  valueFormatter,
}: {
  data: AreaTrendPoint[];
  loading?: boolean;
  title: string;
  valueFormatter: (value: number) => string;
}) {
  return (
    <ChartShell
      title={title}
      loading={loading}
      empty={data.length === 0}
      columns={[
        { key: 'label', label: 'Date' },
        { key: 'value', label: 'Value', align: 'right' },
        { key: 'previous', label: 'Previous', align: 'right' },
      ]}
      rows={data.map((point) => ({
        label: point.label,
        value: valueFormatter(point.value),
        previous: point.previous == null ? '—' : valueFormatter(point.previous),
      }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.border} strokeOpacity={0.5} />
          <XAxis
            dataKey="label"
            tick={chartAxisStyle}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
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
          {data.some((point) => point.previous != null) ? (
            <Area
              type="monotone"
              dataKey="previous"
              stroke={chartColors.ghost}
              fill={chartColors.ghost}
              fillOpacity={0.25}
              strokeWidth={1.5}
              isAnimationActive={false}
              dot={false}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke={chartColors.primary}
            fill={chartColors.primary}
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive
            animationDuration={400}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
