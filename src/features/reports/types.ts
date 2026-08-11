import type { Json } from '@/lib/supabase/database.types';

export type PeriodSnapshotRow = {
  id: string;
  space_id: string;
  period_from: string;
  period_to: string;
  payload: PeriodSnapshotPayload;
  created_at: string;
};

export type PeriodTotals = {
  income_minor: number;
  expense_minor: number;
  net_minor: number;
  transaction_count: number;
  savings_rate: number | null;
};

export type PeriodSnapshotPayload = {
  from: string;
  to: string;
  space_id: string;
  space_name: string;
  base_currency: string;
  totals: PeriodTotals;
  previous_totals: PeriodTotals;
  categories: {
    expense: Array<{
      id: string | null;
      name: string;
      color: string;
      total_minor: number;
      change_minor: number;
    }>;
    income: Array<{
      id: string | null;
      name: string;
      color: string;
      total_minor: number;
      change_minor: number;
    }>;
  };
  participants: Array<{
    id: string;
    display_name: string;
    paid_minor: number;
    owed_minor: number;
  }>;
  budgets: Array<{
    id: string;
    name: string;
    limit_minor: number;
    spent_minor: number;
    remaining_minor: number;
    percent_used: number;
  }>;
  goals: Array<{
    id: string;
    name: string;
    target_minor: number;
    saved_minor: number;
    progress: number;
  }>;
  subscriptions: {
    count: number;
    monthly_cost_minor: number;
  };
  settlements: {
    count: number;
    total_minor: number;
  };
  top_changes: Array<{
    id: string | null;
    name: string;
    color: string;
    change_minor: number;
  }>;
};

export function parseSnapshotPayload(raw: Json): PeriodSnapshotPayload {
  return raw as unknown as PeriodSnapshotPayload;
}
