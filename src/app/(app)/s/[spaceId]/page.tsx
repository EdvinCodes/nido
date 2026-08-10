import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { resolveDashboardPeriod } from '@/features/dashboard/lib/resolve-period';
import {
  getSpaceSeries,
  getSpaceSummary,
  spaceHasTransactions,
} from '@/features/dashboard/queries';
import { getProfile, getSpaceForMember } from '@/features/spaces/queries';

export default async function SpaceDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { spaceId } = await params;
  const sp = await searchParams;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const profile = await getProfile();
  const { range } = resolveDashboardPeriod(
    sp,
    {
      timeZone: membership.space.timezone,
      monthStartsOn: membership.space.month_starts_on,
      weekStartsOn: membership.space.week_starts_on,
    },
    {
      preset: profile?.default_period_preset ?? null,
      from: profile?.default_period_from ?? null,
      to: profile?.default_period_to ?? null,
    },
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardLoaded
          spaceId={spaceId}
          spaceKind={membership.space.kind}
          currency={membership.space.base_currency}
          timeZone={membership.space.timezone}
          monthStartsOn={membership.space.month_starts_on}
          weekStartsOn={membership.space.week_starts_on}
          from={range.from}
          to={range.to}
        />
      </Suspense>
    </main>
  );
}

async function DashboardLoaded({
  spaceId,
  spaceKind,
  currency,
  timeZone,
  monthStartsOn,
  weekStartsOn,
  from,
  to,
}: {
  spaceId: string;
  spaceKind: string;
  currency: string;
  timeZone: string;
  monthStartsOn: number;
  weekStartsOn: number;
  from: string;
  to: string;
}) {
  const isEmptySpace = !(await spaceHasTransactions(spaceId));
  if (isEmptySpace) {
    return (
      <DashboardView
        spaceId={spaceId}
        spaceKind={spaceKind}
        currency={currency}
        timeZone={timeZone}
        monthStartsOn={monthStartsOn}
        weekStartsOn={weekStartsOn}
        summary={{
          from,
          to,
          previous_from: from,
          previous_to: to,
          totals: {
            income_minor: 0,
            expense_minor: 0,
            net_minor: 0,
            transaction_count: 0,
            savings_rate: null,
          },
          previous_totals: {
            income_minor: 0,
            expense_minor: 0,
            net_minor: 0,
            transaction_count: 0,
            savings_rate: null,
          },
          daily: [],
          categories: { expense: [], income: [] },
          participants: [],
          merchants: [],
          accounts: [],
        }}
        series={[]}
        isEmptySpace
      />
    );
  }

  const summary = await getSpaceSummary({ spaceId, from, to });
  const previousSeries = await getSpaceSeries({
    spaceId,
    from: summary.previous_from,
    to: summary.previous_to,
    granularity: 'day',
  });

  return (
    <DashboardView
      spaceId={spaceId}
      spaceKind={spaceKind}
      currency={currency}
      timeZone={timeZone}
      monthStartsOn={monthStartsOn}
      weekStartsOn={weekStartsOn}
      summary={summary}
      series={toCumulativeSeries(previousSeries)}
      isEmptySpace={false}
    />
  );
}

function toCumulativeSeries(
  points: Awaited<ReturnType<typeof getSpaceSeries>>,
): Awaited<ReturnType<typeof getSpaceSeries>> {
  return points.reduce<Awaited<ReturnType<typeof getSpaceSeries>>>((acc, point) => {
    const previous = acc.at(-1)?.net_minor ?? 0;
    acc.push({ ...point, net_minor: previous + point.net_minor });
    return acc;
  }, []);
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-6 lg:px-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
