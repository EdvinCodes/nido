'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { chartAxisStyle, chartColors, chartTooltipStyle } from '@/components/charts/tokens';
import type { InlineChartPoint } from '@/features/assistant/lib/inline-chart-series';

export function AssistantCompareBars({
  points,
  periodALabel,
  periodBLabel,
}: {
  points: InlineChartPoint[];
  periodALabel: string;
  periodBLabel: string;
}) {
  const data = points.map((point) => ({
    label: point.label,
    periodA: point.a,
    periodB: point.b ?? 0,
  }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={chartAxisStyle} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => [
              String(value ?? 0),
              name === 'periodA' ? periodALabel : periodBLabel,
            ]}
          />
          <Bar
            dataKey="periodA"
            fill={chartColors.border}
            radius={[4, 4, 0, 0]}
            isAnimationActive
          />
          <Bar
            dataKey="periodB"
            fill={chartColors.primary}
            radius={[4, 4, 0, 0]}
            isAnimationActive
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
