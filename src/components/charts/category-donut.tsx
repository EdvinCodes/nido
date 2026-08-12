'use client';

import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslations } from 'next-intl';
import { ChartShell } from './chart-shell';
import { chartTooltipStyle } from './tokens';

export type CategoryDonutSlice = {
  id: string | null;
  name: string;
  color: string;
  value: number;
  href?: string;
};

export function CategoryDonut({
  data,
  loading,
  title,
  centerLabel,
  valueFormatter,
  onSliceClick,
}: {
  data: CategoryDonutSlice[];
  loading?: boolean;
  title: string;
  centerLabel: string;
  valueFormatter: (value: number) => string;
  onSliceClick?: (slice: CategoryDonutSlice) => void;
}) {
  const t = useTranslations('charts.columns');
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartShell
      title={title}
      heightClassName="h-72"
      loading={loading}
      empty={data.length === 0 || total === 0}
      columns={[
        { key: 'name', label: t('category') },
        { key: 'value', label: t('amount'), align: 'right' },
      ]}
      rows={data.map((slice) => ({
        name: slice.name,
        value: valueFormatter(slice.value),
      }))}
    >
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.map((slice) => ({ ...slice, fill: slice.color }))}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={1.5}
              isAnimationActive
              animationDuration={400}
              onClick={(_, index) => {
                const slice = data[index];
                if (slice) onSliceClick?.(slice);
              }}
              style={{ cursor: onSliceClick ? 'pointer' : undefined }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) => valueFormatter(Number(value ?? 0))}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
          <span className="amount text-lg font-semibold tracking-tight">
            {valueFormatter(total)}
          </span>
        </div>
      </div>
    </ChartShell>
  );
}
