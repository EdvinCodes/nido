'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell } from './chart-shell';
import { chartAxisStyle, chartColors, chartTooltipStyle } from './tokens';

export type GroupedBarsPoint = {
  label: string;
  income: number;
  expense: number;
};

export function GroupedBars({
  data,
  loading,
  title,
  valueFormatter,
}: {
  data: GroupedBarsPoint[];
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
        { key: 'label', label: 'Period' },
        { key: 'income', label: 'Income', align: 'right' },
        { key: 'expense', label: 'Expense', align: 'right' },
      ]}
      rows={data.map((point) => ({
        label: point.label,
        income: valueFormatter(point.income),
        expense: valueFormatter(point.expense),
      }))}
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
          <Bar dataKey="income" fill={chartColors.income} radius={[4, 4, 0, 0]} isAnimationActive />
          <Bar
            dataKey="expense"
            fill={chartColors.expense}
            radius={[4, 4, 0, 0]}
            isAnimationActive
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
