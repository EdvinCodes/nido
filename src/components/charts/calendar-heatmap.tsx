'use client';

import { ChartShell } from './chart-shell';
import { cn } from '@/lib/utils';

export type CalendarHeatmapCell = {
  date: string;
  value: number;
  label: string;
};

export function CalendarHeatmap({
  data,
  loading,
  title,
  valueFormatter,
}: {
  data: CalendarHeatmapCell[];
  loading?: boolean;
  title: string;
  valueFormatter: (value: number) => string;
}) {
  const max = Math.max(0, ...data.map((cell) => cell.value));

  return (
    <ChartShell
      title={title}
      heightClassName="min-h-40"
      loading={loading}
      empty={data.length === 0}
      columns={[
        { key: 'date', label: 'Date' },
        { key: 'value', label: 'Amount', align: 'right' },
      ]}
      rows={data.map((cell) => ({
        date: cell.label,
        value: valueFormatter(cell.value),
      }))}
    >
      <div className="grid grid-cols-7 gap-1">
        {data.map((cell) => {
          const intensity = max === 0 ? 0 : cell.value / max;
          return (
            <div
              key={cell.date}
              title={`${cell.label}: ${valueFormatter(cell.value)}`}
              className={cn('aspect-square rounded-sm border border-border/40')}
              style={{
                backgroundColor:
                  intensity === 0
                    ? 'transparent'
                    : `color-mix(in oklch, var(--color-primary) ${Math.round(intensity * 85)}%, transparent)`,
              }}
            />
          );
        })}
      </div>
    </ChartShell>
  );
}
