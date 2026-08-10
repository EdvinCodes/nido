import type { Database } from '@/lib/supabase/database.types';
import type { BudgetUrgency } from './lib/budget-math';

export type BudgetRow = Database['nido']['Tables']['budgets']['Row'];
export type BudgetPeriodRow = Database['nido']['Tables']['budget_periods']['Row'];
export type BudgetScope = Database['nido']['Enums']['budget_scope'];
export type BudgetPeriodKind = Database['nido']['Enums']['budget_period'];

export type BudgetCardModel = {
  id: string;
  name: string;
  scope: BudgetScope;
  period: BudgetPeriodKind;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  participantId: string | null;
  participantName: string | null;
  currency: string;
  includeSubcategories: boolean;
  rollover: boolean;
  alertThresholds: number[];
  isActive: boolean;
  currentPeriod: {
    id: string;
    startsOn: string;
    endsOn: string;
    limitMinor: number;
    spentMinor: number;
  } | null;
  sparkline: { label: string; value: number }[];
  urgency: BudgetUrgency;
  ratio: number;
  remainingMinor: number;
  daysLeft: number;
  dailyAllowanceMinor: number | null;
};

export type BudgetSuggestion = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  suggestedLimitMinor: number;
};

export type AttentionBudget = {
  id: string;
  name: string;
  ratio: number;
  urgency: BudgetUrgency;
  spentMinor: number;
  limitMinor: number;
  currency: string;
  categoryId: string | null;
};
