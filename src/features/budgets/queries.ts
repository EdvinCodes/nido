import { createClient } from '@/lib/supabase/server';
import {
  compareBudgetUrgency,
  dailyAllowanceMinor,
  daysLeftInclusive,
  remainingMinor,
  spentRatio,
  urgencyFromRatio,
} from './lib/budget-math';
import type { AttentionBudget, BudgetCardModel, BudgetSuggestion } from './types';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listBudgetCards(
  spaceId: string,
  today = todayUtc(),
): Promise<BudgetCardModel[]> {
  const supabase = await createClient();
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('space_id', spaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  const budgetRows = budgets;
  if (budgetRows.length === 0) return [];

  const ids = budgetRows.map((b) => b.id);
  const categoryIds = [
    ...new Set(budgetRows.map((b) => b.category_id).filter((id): id is string => Boolean(id))),
  ];
  const participantIds = [
    ...new Set(budgetRows.map((b) => b.participant_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: periods }, { data: categories }, { data: participants }] = await Promise.all([
    supabase.from('budget_periods').select('*').in('budget_id', ids).order('starts_on'),
    categoryIds.length
      ? supabase.from('categories').select('id, name, color').in('id', categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; color: string }> }),
    participantIds.length
      ? supabase.from('participants').select('id, display_name').in('id', participantIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
  ]);

  const catMap = new Map((categories ?? []).map((c) => [c.id, c]));
  const partMap = new Map((participants ?? []).map((p) => [p.id, p]));
  const periodsByBudget = new Map<string, NonNullable<typeof periods>>();
  for (const p of periods ?? []) {
    const list = periodsByBudget.get(p.budget_id) ?? [];
    list.push(p);
    periodsByBudget.set(p.budget_id, list);
  }

  const cards: BudgetCardModel[] = budgetRows.map((row) => {
    const budgetPeriods = [...(periodsByBudget.get(row.id) ?? [])].sort((a, b) =>
      a.starts_on < b.starts_on ? -1 : 1,
    );
    const current =
      budgetPeriods.find((p) => p.starts_on <= today && p.ends_on >= today) ??
      budgetPeriods[budgetPeriods.length - 1] ??
      null;
    const spent = current?.spent_minor ?? 0;
    const limit = current?.limit_minor ?? row.limit_minor;
    const ratio = spentRatio(spent, limit);
    const urgency = urgencyFromRatio(ratio, spent);
    const category = row.category_id ? catMap.get(row.category_id) : undefined;
    const participant = row.participant_id ? partMap.get(row.participant_id) : undefined;
    const sparkSource = budgetPeriods.slice(-6);

    return {
      id: row.id,
      name: row.name,
      scope: row.scope,
      period: row.period,
      categoryId: row.category_id,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      participantId: row.participant_id,
      participantName: participant?.display_name ?? null,
      currency: row.currency,
      includeSubcategories: row.include_subcategories,
      rollover: row.rollover,
      alertThresholds: row.alert_thresholds,
      isActive: row.is_active,
      currentPeriod: current
        ? {
            id: current.id,
            startsOn: current.starts_on,
            endsOn: current.ends_on,
            limitMinor: current.limit_minor,
            spentMinor: current.spent_minor,
          }
        : null,
      sparkline: sparkSource.map((p) => ({
        label: p.starts_on.slice(0, 7),
        value: p.spent_minor,
      })),
      urgency,
      ratio,
      remainingMinor: remainingMinor(spent, limit),
      daysLeft: current ? daysLeftInclusive(current.ends_on, today) : 0,
      dailyAllowanceMinor: current
        ? dailyAllowanceMinor(remainingMinor(spent, limit), current.ends_on, today)
        : null,
    };
  });

  return cards.sort((a, b) => {
    const u = compareBudgetUrgency(a.urgency, b.urgency);
    if (u !== 0) return u;
    return b.ratio - a.ratio;
  });
}

export async function getBudgetDetail(spaceId: string, budgetId: string, today = todayUtc()) {
  const cards = await listBudgetCards(spaceId, today);
  const card = cards.find((c) => c.id === budgetId);
  if (!card) return null;

  const supabase = await createClient();
  const { data: periods } = await supabase
    .from('budget_periods')
    .select('*')
    .eq('budget_id', budgetId)
    .order('starts_on', { ascending: true });

  const current = card.currentPeriod;
  let transactions: Array<{
    id: string;
    booked_on: string;
    description: string;
    merchant: string | null;
    base_amount_minor: number;
    currency: string;
  }> = [];

  if (current) {
    let query = supabase
      .from('transactions')
      .select('id, booked_on, description, merchant, base_amount_minor, currency')
      .eq('space_id', spaceId)
      .eq('kind', 'expense')
      .is('deleted_at', null)
      .gte('booked_on', current.startsOn)
      .lte('booked_on', current.endsOn)
      .order('booked_on', { ascending: false })
      .limit(50);
    if (card.categoryId) query = query.eq('category_id', card.categoryId);
    const { data } = await query;
    transactions = data ?? [];
  }

  return { card, periods: periods ?? [], transactions };
}

export async function getBudgetSuggestions(spaceId: string): Promise<BudgetSuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('suggest_budgets', { p_space_id: spaceId });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    category_id: string;
    category_name: string;
    category_color: string;
    suggested_limit_minor: number;
  }>;
  return rows.map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    suggestedLimitMinor: r.suggested_limit_minor,
  }));
}

export async function getAttentionBudgets(
  spaceId: string,
  today = todayUtc(),
): Promise<AttentionBudget[]> {
  const cards = await listBudgetCards(spaceId, today);
  return cards
    .filter((c) => c.urgency === 'over' || c.urgency === 'approaching')
    .map((c) => ({
      id: c.id,
      name: c.name,
      ratio: c.ratio,
      urgency: c.urgency,
      spentMinor: c.currentPeriod?.spentMinor ?? 0,
      limitMinor: c.currentPeriod?.limitMinor ?? 0,
      currency: c.currency,
      categoryId: c.categoryId,
    }));
}

export async function getCategoryBudgetProgress(
  spaceId: string,
  today = todayUtc(),
): Promise<Record<string, { ratio: number; budgetId: string }>> {
  const cards = await listBudgetCards(spaceId, today);
  const map: Record<string, { ratio: number; budgetId: string }> = {};
  for (const card of cards) {
    if (card.scope === 'category' && card.categoryId) {
      map[card.categoryId] = { ratio: card.ratio, budgetId: card.id };
    }
  }
  return map;
}
