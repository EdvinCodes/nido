import { createClient } from '@/lib/supabase/server';
import { annualMinor, monthlyMinor, type RecurrenceFreq } from './lib/annualize';
import { asNumber, asString } from './lib/json';
import type {
  GhostSubscription,
  RecurringCandidate,
  RuleDetail,
  SubscriptionCard,
  UpcomingCharge,
} from './types';

function cycleKey(freq: RecurrenceFreq, interval: number): string {
  return `${interval}:${freq}`;
}

function asFreq(value: string): RecurrenceFreq {
  if (value === 'day' || value === 'week' || value === 'month' || value === 'year') return value;
  return 'month';
}

export async function listSubscriptionCards(spaceId: string): Promise<{
  active: SubscriptionCard[];
  cancelled: SubscriptionCard[];
  monthlyTotalMinor: number;
  annualTotalMinor: number;
}> {
  const supabase = await createClient();
  const { data: rules, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('space_id', spaceId)
    .order('next_run_on', { ascending: true });
  if (error) throw new Error(error.message);

  const ruleRows = rules;
  const ids = ruleRows.map((r) => r.id);
  const [{ data: txs }, { data: prices }] = await Promise.all([
    ids.length
      ? supabase
          .from('transactions')
          .select('recurring_rule_id, amount_minor')
          .in('recurring_rule_id', ids)
          .is('deleted_at', null)
      : Promise.resolve({
          data: [] as Array<{ recurring_rule_id: string | null; amount_minor: number }>,
        }),
    ids.length
      ? supabase
          .from('recurring_price_changes')
          .select('rule_id, new_amount_minor, detected_on')
          .in('rule_id', ids)
          .order('detected_on', { ascending: true })
      : Promise.resolve({
          data: [] as Array<{ rule_id: string; new_amount_minor: number; detected_on: string }>,
        }),
  ]);

  const paid = new Map<string, number>();
  for (const tx of txs ?? []) {
    if (!tx.recurring_rule_id) continue;
    paid.set(tx.recurring_rule_id, (paid.get(tx.recurring_rule_id) ?? 0) + tx.amount_minor);
  }
  const spark = new Map<string, number[]>();
  for (const p of prices ?? []) {
    const list = spark.get(p.rule_id) ?? [];
    list.push(p.new_amount_minor);
    spark.set(p.rule_id, list);
  }

  const cards: SubscriptionCard[] = ruleRows.map((r) => {
    const freq = asFreq(r.freq);
    const month = monthlyMinor(r.amount_minor, freq, r.interval_count);
    const year = annualMinor(r.amount_minor, freq, r.interval_count);
    return {
      id: r.id,
      name: r.name,
      merchant: r.merchant,
      amountMinor: r.amount_minor,
      currency: r.currency,
      freq,
      intervalCount: r.interval_count,
      nextRunOn: r.next_run_on,
      splitMode: r.split_mode,
      totalPaidMinor: paid.get(r.id) ?? 0,
      monthlyMinor: month,
      annualMinor: year,
      isActive: r.is_active && !r.cancelled_at,
      cancelledAt: r.cancelled_at,
      cancelUrl: r.cancel_url,
      priceSpark: spark.get(r.id) ?? [],
      cycleKey: cycleKey(freq, r.interval_count),
    };
  });

  const active = cards.filter((c) => c.isActive);
  const cancelled = cards.filter((c) => !c.isActive);
  return {
    active,
    cancelled,
    monthlyTotalMinor: active.reduce((sum, c) => sum + c.monthlyMinor, 0),
    annualTotalMinor: active.reduce((sum, c) => sum + c.annualMinor, 0),
  };
}

export async function getSubscriptionDetail(
  spaceId: string,
  ruleId: string,
): Promise<RuleDetail | null> {
  const { active, cancelled } = await listSubscriptionCards(spaceId);
  const card = [...active, ...cancelled].find((c) => c.id === ruleId);
  if (!card) return null;

  const supabase = await createClient();
  const { data: rule } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('space_id', spaceId)
    .maybeSingle();
  if (!rule) return null;

  const [{ data: charges }, { data: priceChanges }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, booked_on, amount_minor')
      .eq('recurring_rule_id', ruleId)
      .is('deleted_at', null)
      .order('booked_on', { ascending: false }),
    supabase
      .from('recurring_price_changes')
      .select('id, old_amount_minor, new_amount_minor, detected_on')
      .eq('rule_id', ruleId)
      .order('detected_on', { ascending: false }),
  ]);

  return {
    ...card,
    kind: rule.kind,
    autoCreate: rule.auto_create,
    reminderDaysBefore: rule.reminder_days_before,
    notes: rule.notes,
    charges: (charges ?? []).map((c) => ({
      id: c.id,
      bookedOn: c.booked_on,
      amountMinor: c.amount_minor,
    })),
    priceChanges: (priceChanges ?? []).map((p) => ({
      id: p.id,
      oldAmountMinor: p.old_amount_minor,
      newAmountMinor: p.new_amount_minor,
      detectedOn: p.detected_on,
    })),
  };
}

export async function listRecurringCandidates(spaceId: string): Promise<RecurringCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('detect_recurring_candidates', {
    p_space_id: spaceId,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];

  return data.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      merchant: asString(row.merchant),
      merchantKey: asString(row.merchant_key),
      currency: asString(row.currency, 'EUR'),
      amountMinor: asNumber(row.amount_minor),
      suggestedFreq: asFreq(asString(row.suggested_freq, 'month')),
      suggestedInterval: asNumber(row.suggested_interval, 1),
      categoryId: typeof row.category_id === 'string' ? row.category_id : null,
      accountId: typeof row.account_id === 'string' ? row.account_id : null,
      payerParticipantId:
        typeof row.payer_participant_id === 'string' ? row.payer_participant_id : null,
      splitMode: asString(row.split_mode, 'equal'),
      firstOn: asString(row.first_on),
      lastOn: asString(row.last_on),
      transactionIds: Array.isArray(row.transaction_ids)
        ? row.transaction_ids.filter((id): id is string => typeof id === 'string')
        : [],
    };
  });
}

export async function listGhostSubscriptions(spaceId: string): Promise<GhostSubscription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('detect_ghost_subscriptions', {
    p_space_id: spaceId,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];

  return data.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      ruleId: asString(row.rule_id),
      name: asString(row.name),
      merchant: typeof row.merchant === 'string' ? row.merchant : null,
      amountMinor: asNumber(row.amount_minor),
      currency: asString(row.currency, 'EUR'),
      chargeCount: asNumber(row.charge_count),
      totalPaidMinor: asNumber(row.total_paid_minor),
      monthsActive: asNumber(row.months_active, 1),
      cancelUrl: typeof row.cancel_url === 'string' ? row.cancel_url : null,
    };
  });
}

export async function getUpcomingCharges(
  spaceId: string,
  withinDays = 14,
): Promise<UpcomingCharge[]> {
  const { active } = await listSubscriptionCards(spaceId);
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() + withinDays);
  const todayStr = today.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);

  return active
    .filter((r) => r.nextRunOn >= todayStr && r.nextRunOn <= untilStr)
    .map((r) => ({
      ruleId: r.id,
      name: r.name,
      merchant: r.merchant,
      amountMinor: r.amountMinor,
      currency: r.currency,
      on: r.nextRunOn,
    }))
    .sort((a, b) => a.on.localeCompare(b.on));
}
