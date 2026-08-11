const TOOL_LABELS: Record<string, string> = {
  getPeriodSummary: 'Summarising the period',
  getSpendingByCategory: 'Looking at spending by category',
  comparePeriods: 'Comparing periods',
  getTransactions: 'Searching transactions',
  getTopMerchants: 'Finding top merchants',
  getSubscriptions: 'Reviewing subscriptions',
  getBudgetStatus: 'Checking budgets',
  getGoals: 'Checking savings goals',
  getBalances: 'Calculating balances',
  getRecurringForecast: 'Forecasting upcoming charges',
  getTrend: 'Building a trend',
  findAnomalies: 'Looking for unusual activity',
};

/** Friendly progress line for a tool invocation. */
export function toolProgressLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? 'Checking your data';
}
