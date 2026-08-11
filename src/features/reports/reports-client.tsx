'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { exportReportAction } from '@/features/reports/actions';
import { formatSavingsRate } from '@/features/reports/lib/savings-rate';
import type { PeriodSnapshotRow } from '@/features/reports/types';
import { chartAxisStyle, chartColors, chartTooltipStyle } from '@/components/charts/tokens';
import { route } from '@/lib/routes';
import { toast } from 'sonner';

function downloadBase64(filename: string, mimeType: string, base64: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({
  spaceId,
  baseCurrency,
  snapshots,
  savingsSeries,
}: {
  spaceId: string;
  baseCurrency: string;
  snapshots: PeriodSnapshotRow[];
  savingsSeries: Array<{ periodFrom: string; periodTo: string; savingsRate: number | null }>;
}) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const latest = snapshots[0];

  function exportFormat(format: 'pdf' | 'xlsx' | 'csv'): void {
    if (!latest) return;
    startTransition(async () => {
      const result = await exportReportAction({
        spaceId,
        from: latest.period_from,
        to: latest.period_to,
        format,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      downloadBase64(result.data.filename, result.data.mimeType, result.data.base64);
    });
  }

  const chartData = savingsSeries.map((s) => ({
    label: s.periodFrom.slice(0, 7),
    rate: s.savingsRate == null ? null : Math.round(s.savingsRate * 1000) / 10,
  }));

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={route(`/s/${spaceId}/reports/compare`)}>{t('compare')}</Link>
          </Button>
          <Button
            disabled={pending || !latest}
            size="sm"
            onClick={() => {
              exportFormat('pdf');
            }}
          >
            {t('exportPdf')}
          </Button>
          <Button
            disabled={pending || !latest}
            size="sm"
            variant="outline"
            onClick={() => {
              exportFormat('xlsx');
            }}
          >
            {t('exportXlsx')}
          </Button>
          <Button
            disabled={pending || !latest}
            size="sm"
            variant="outline"
            onClick={() => {
              exportFormat('csv');
            }}
          >
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium">{t('savingsRateTrend')}</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chartColors.border}
                strokeOpacity={0.5}
              />
              <XAxis dataKey="label" tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value) => {
                  if (value == null || Array.isArray(value)) return '—';
                  return `${String(value)}%`;
                }}
              />
              <Line type="monotone" dataKey="rate" stroke={chartColors.primary} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">{t('closedPeriods')}</h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {snapshots.map((snap) => (
              <li key={snap.id}>
                <Link
                  href={route(`/s/${spaceId}/reports/${snap.id}`)}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">
                      {snap.period_from} – {snap.period_to}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('savingsRate')}: {formatSavingsRate(snap.payload.totals.savings_rate)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <Amount
                      minor={snap.payload.totals.net_minor}
                      currency={baseCurrency}
                      locale={locale}
                      tone={snap.payload.totals.net_minor >= 0 ? 'income' : 'expense'}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
