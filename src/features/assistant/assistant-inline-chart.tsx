'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { InlineChartSeries } from '@/features/assistant/lib/inline-chart-series';
import { Skeleton } from '@/components/ui/skeleton';

const Sparkline = dynamic(() => import('@/components/charts/sparkline').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-16 w-full rounded-md" />,
});

const CompareBars = dynamic(
  () => import('@/features/assistant/assistant-compare-bars').then((m) => m.AssistantCompareBars),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full rounded-md" /> },
);

export function AssistantInlineChart({ series }: { series: InlineChartSeries }) {
  const t = useTranslations('assistant.panel');

  if (series.kind === 'trend') {
    return (
      <figure className="space-y-1">
        <figcaption className="text-xs text-muted-foreground">{t('chartTrend')}</figcaption>
        <Sparkline
          data={series.points.map((point) => ({ label: point.label, value: point.a }))}
          title={t('chartTrend')}
          tone="neutral"
        />
      </figure>
    );
  }

  return (
    <figure className="space-y-1">
      <figcaption className="text-xs text-muted-foreground">{t('chartCompare')}</figcaption>
      <CompareBars
        points={series.points}
        periodALabel={t('chartPeriodA')}
        periodBLabel={t('chartPeriodB')}
      />
    </figure>
  );
}
