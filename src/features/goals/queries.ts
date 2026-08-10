import { createClient } from '@/lib/supabase/server';
import { goalProgressRatio, remainingMinor } from './lib/pace';
import type { GoalCardModel, GoalDetailModel, GoalProjection, GoalStatus } from './types';

function asGoalStatus(value: string): GoalStatus {
  if (value === 'active' || value === 'reached' || value === 'paused' || value === 'archived') {
    return value;
  }
  return 'active';
}

function parseProjection(raw: unknown, goalId: string): GoalProjection {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    goalId,
    remainingMinor: Number(row.remaining_minor ?? 0),
    requiredMonthlyMinor:
      row.required_monthly_minor === null || row.required_monthly_minor === undefined
        ? null
        : Number(row.required_monthly_minor),
    averageMonthlyMinor: Number(row.average_monthly_minor ?? 0),
    projectedCompletionOn:
      typeof row.projected_completion_on === 'string' ? row.projected_completion_on : null,
    onPace: typeof row.on_pace === 'boolean' ? row.on_pace : null,
    targetDate: typeof row.target_date === 'string' ? row.target_date : null,
    targetPassed: Boolean(row.target_passed),
  };
}

export async function listGoalCards(spaceId: string): Promise<GoalCardModel[]> {
  const supabase = await createClient();
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('space_id', spaceId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  if (!goals.length) return [];

  const accountIds = [
    ...new Set(goals.map((g) => g.account_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: accounts } = accountIds.length
    ? await supabase.from('accounts').select('id, name').in('id', accountIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const cards = await Promise.all(
    goals.map(async (goal) => {
      const { data: projection } = await supabase.rpc('goal_projection', { p_goal_id: goal.id });
      return {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        targetMinor: goal.target_minor,
        savedMinor: goal.saved_minor,
        currency: goal.currency,
        targetDate: goal.target_date,
        accountId: goal.account_id,
        accountName: goal.account_id ? (accountMap.get(goal.account_id) ?? null) : null,
        color: goal.color,
        icon: goal.icon,
        status: asGoalStatus(goal.status),
        projection: parseProjection(projection, goal.id),
      } satisfies GoalCardModel;
    }),
  );

  return cards;
}

export async function getGoalDetail(
  spaceId: string,
  goalId: string,
): Promise<GoalDetailModel | null> {
  const supabase = await createClient();
  const { data: goal, error } = await supabase
    .from('goals')
    .select('*')
    .eq('space_id', spaceId)
    .eq('id', goalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!goal) return null;

  const { data: projection } = await supabase.rpc('goal_projection', { p_goal_id: goalId });
  const { data: contributions, error: cErr } = await supabase
    .from('goal_contributions')
    .select('id, amount_minor, contributed_on, note, participant_id, transaction_id')
    .eq('goal_id', goalId)
    .order('contributed_on', { ascending: true })
    .order('created_at', { ascending: true });
  if (cErr) throw new Error(cErr.message);

  const contributionRows = contributions;
  const participantIds = [...new Set(contributionRows.map((c) => c.participant_id))];
  const { data: participants } = participantIds.length
    ? await supabase.from('participants').select('id, display_name').in('id', participantIds)
    : { data: [] as Array<{ id: string; display_name: string }> };
  const partMap = new Map((participants ?? []).map((p) => [p.id, p.display_name]));

  let running = 0;
  const cumulative = contributionRows.map((c) => {
    running += c.amount_minor;
    return { on: c.contributed_on, savedMinor: running };
  });

  const byParticipantMap = new Map<
    string,
    { participantId: string; participantName: string; totalMinor: number }
  >();
  for (const c of contributionRows) {
    const existing = byParticipantMap.get(c.participant_id) ?? {
      participantId: c.participant_id,
      participantName: partMap.get(c.participant_id) ?? '—',
      totalMinor: 0,
    };
    existing.totalMinor += c.amount_minor;
    byParticipantMap.set(c.participant_id, existing);
  }

  let accountName: string | null = null;
  if (goal.account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', goal.account_id)
      .maybeSingle();
    accountName = account?.name ?? null;
  }

  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    targetMinor: goal.target_minor,
    savedMinor: goal.saved_minor,
    currency: goal.currency,
    targetDate: goal.target_date,
    accountId: goal.account_id,
    accountName,
    color: goal.color,
    icon: goal.icon,
    status: asGoalStatus(goal.status),
    projection: parseProjection(projection, goal.id),
    contributions: contributionRows.map((c) => ({
      id: c.id,
      amountMinor: c.amount_minor,
      contributedOn: c.contributed_on,
      note: c.note,
      participantId: c.participant_id,
      participantName: partMap.get(c.participant_id) ?? '—',
      transactionId: c.transaction_id,
    })),
    byParticipant: [...byParticipantMap.values()],
    cumulative,
  };
}

export async function getActiveGoalProgress(
  spaceId: string,
): Promise<
  Array<{ id: string; name: string; ratio: number; remainingMinor: number; currency: string }>
> {
  const cards = await listGoalCards(spaceId);
  return cards
    .filter((c) => c.status === 'active' || c.status === 'reached')
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      ratio: goalProgressRatio(c.savedMinor, c.targetMinor),
      remainingMinor: remainingMinor(c.targetMinor, c.savedMinor),
      currency: c.currency,
    }));
}
