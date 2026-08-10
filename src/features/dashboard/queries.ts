import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { untyped } from '@/features/transactions/db';
import { dashboardCacheTag } from './cache';
import { spaceSeriesSchema, spaceSummarySchema } from './schemas';
import type { SpaceSeriesPoint, SpaceSummary } from './types';

async function assertSpaceMember(spaceId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthenticated');

  const { data, error } = await supabase
    .from('space_members')
    .select('participant_id')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('forbidden');
}

async function fetchSpaceSummaryCached(
  spaceId: string,
  from: string,
  to: string,
  participantId: string | null,
): Promise<SpaceSummary> {
  const admin = createAdminClient();
  const { data, error } = await untyped(admin).rpc('space_summary', {
    p_space_id: spaceId,
    p_from: from,
    p_to: to,
    p_participant_id: participantId,
  });
  if (error) throw new Error(error.message);
  return data as SpaceSummary;
}

async function fetchSpaceSeriesCached(
  spaceId: string,
  from: string,
  to: string,
  granularity: 'day' | 'week' | 'month',
): Promise<SpaceSeriesPoint[]> {
  const admin = createAdminClient();
  const { data, error } = await untyped(admin).rpc('space_series', {
    p_space_id: spaceId,
    p_from: from,
    p_to: to,
    p_granularity: granularity,
  });
  if (error) throw new Error(error.message);
  return data as SpaceSeriesPoint[];
}

export async function getSpaceSummary(input: {
  spaceId: string;
  from: string;
  to: string;
  participantId?: string | null;
}): Promise<SpaceSummary> {
  const parsed = spaceSummarySchema.parse(input);
  await assertSpaceMember(parsed.spaceId);
  const participantKey = parsed.participantId ?? 'all';

  return unstable_cache(
    () =>
      fetchSpaceSummaryCached(parsed.spaceId, parsed.from, parsed.to, parsed.participantId ?? null),
    ['space-summary', parsed.spaceId, parsed.from, parsed.to, participantKey],
    { tags: [dashboardCacheTag(parsed.spaceId)], revalidate: 60 },
  )();
}

export async function getSpaceSeries(input: {
  spaceId: string;
  from: string;
  to: string;
  granularity?: 'day' | 'week' | 'month';
}): Promise<SpaceSeriesPoint[]> {
  const parsed = spaceSeriesSchema.parse({
    ...input,
    granularity: input.granularity ?? 'day',
  });
  await assertSpaceMember(parsed.spaceId);

  return unstable_cache(
    () => fetchSpaceSeriesCached(parsed.spaceId, parsed.from, parsed.to, parsed.granularity),
    ['space-series', parsed.spaceId, parsed.from, parsed.to, parsed.granularity],
    { tags: [dashboardCacheTag(parsed.spaceId)], revalidate: 60 },
  )();
}

export async function spaceHasTransactions(spaceId: string): Promise<boolean> {
  await assertSpaceMember(spaceId);
  const admin = createAdminClient();
  const { data, error } = await untyped(admin)
    .from<{ id: string }>('transactions')
    .select('id')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
