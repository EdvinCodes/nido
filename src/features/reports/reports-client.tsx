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
import { EmptyState } from '@/components/ui/empty-state';
import { exportReportAction } from '@/features/reports/actions';
import { formatSavingsRate } from '@/features/reports/lib/savings-rate';
import type { PeriodSnapshotPayload, PeriodSnapshotRow } from '@/features/reports/types';
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

type OpenPeriod = {
  periodFrom: string;
  periodTo: string;
  isCurrent: boolean;
  payload: PeriodSnapshotPayload;
};

export function ReportsClient({
  spaceId,
  baseCurrency,
  snapshots,
  savingsSeries,
  openPeriods,
}: {
  spaceId: string;
  baseCurrency: string;
  snapshots: PeriodSnapshotRow[];
  savingsSeries: Array<{ periodFrom: string; periodTo: string; savingsRate: number | null }>;
  openPeriods: OpenPeriod[];
}) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const latest = snapshots[0];
  const exportTarget = latest ?? {
    period_from: openPeriods[0]?.periodFrom,
    period_to: openPeriods[0]?.periodTo,
  };

  function exportFormat(format: 'pdf' | 'xlsx' | 'csv', from: string, to: string): void {
    startTransition(async () => {
      const result = await exportReportAction({
        spaceId,
        from,
        to,
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
            disabled={pending || !exportTarget.period_from || !exportTarget.period_to}
            size="sm"
            onClick={() => {
              if (!exportTarget.period_from || !exportTarget.period_to) return;
              exportFormat('pdf', exportTarget.period_from, exportTarget.period_to);
            }}
          >
            {t('exportPdf')}
          </Button>
          <Button
            disabled={pending || !exportTarget.period_from || !exportTarget.period_to}
            size="sm"
            variant="outline"
            onClick={() => {
              if (!exportTarget.period_from || !exportTarget.period_to) return;
              exportFormat('xlsx', exportTarget.period_from, exportTarget.period_to);
            }}
          >
            {t('exportXlsx')}
          </Button>
          <Button
            disabled={pending || !exportTarget.period_from || !exportTarget.period_to}
            size="sm"
            variant="outline"
            onClick={() => {
              if (!exportTarget.period_from || !exportTarget.period_to) return;
              exportFormat('csv', exportTarget.period_from, exportTarget.period_to);
            }}
          >
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium">{t('openPeriods')}</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {openPeriods.map((period) => (
            <li
              key={`${period.periodFrom}-${period.periodTo}`}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {period.isCurrent ? t('thisMonth') : t('pastMonth')}
              </p>
              <p className="mt-1 text-sm font-medium">
                {period.periodFrom} – {period.periodTo}
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('income')}</span>
                  <Amount
                    minor={period.payload.totals.income_minor}
                    currency={baseCurrency}
                    locale={locale}
                    tone="income"
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('expenses')}</span>
                  <Amount
                    minor={period.payload.totals.expense_minor}
                    currency={baseCurrency}
                    locale={locale}
                    tone="expense"
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('net')}</span>
                  <Amount
                    minor={period.payload.totals.net_minor}
                    currency={baseCurrency}
                    locale={locale}
                    tone={period.payload.totals.net_minor >= 0 ? 'income' : 'expense'}
                  />
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  {t('savingsRate')}: {formatSavingsRate(period.payload.totals.savings_rate)}
                </p>
              </div>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  exportFormat('pdf', period.periodFrom, period.periodTo);
                }}
              >
                {t('exportPdf')}
              </Button>
            </li>
          ))}
        </ul>
      </section>

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
          <EmptyState
            size="compact"
            title={t('emptyTitle')}
            body={t('empty')}
            action={
              <Button asChild variant="outline">
                <Link href={route(`/s/${spaceId}`)}>{t('emptyCta')}</Link>
              </Button>
            }
          />
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
