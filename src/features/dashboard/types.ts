export type SummaryTotals = {
  income_minor: number;
  expense_minor: number;
  net_minor: number;
  transaction_count: number;
  savings_rate: number | null;
};

export type SummaryDailyPoint = {
  date: string;
  income_minor: number;
  expense_minor: number;
  cumulative_net_minor: number;
};

export type SummaryCategory = {
  id: string | null;
  name: string;
  color: string;
  icon: string;
  total_minor: number;
  share: number;
  count: number;
  change_minor: number;
};

export type SummaryParticipant = {
  id: string;
  display_name: string;
  color: string;
  paid_minor: number;
  owed_minor: number;
};

export type SummaryMerchant = {
  name: string;
  total_minor: number;
  count: number;
};

export type SummaryAccount = {
  id: string;
  name: string;
  color: string;
  currency: string;
  include_in_totals: boolean;
  balance_minor: number;
};

export type SpaceSummary = {
  from: string;
  to: string;
  previous_from: string;
  previous_to: string;
  totals: SummaryTotals;
  previous_totals: SummaryTotals;
  daily: SummaryDailyPoint[];
  categories: {
    expense: SummaryCategory[];
    income: SummaryCategory[];
  };
  participants: SummaryParticipant[];
  merchants: SummaryMerchant[];
  accounts: SummaryAccount[];
};

export type SpaceSeriesPoint = {
  bucket_start: string;
  income_minor: number;
  expense_minor: number;
  net_minor: number;
};

export type SearchTransactionHit = {
  id: string;
  booked_on: string;
  kind: 'expense' | 'income' | 'transfer';
  description: string;
  merchant: string | null;
  amount_minor: number;
  base_amount_minor: number;
  currency: string;
  category_id: string | null;
};
