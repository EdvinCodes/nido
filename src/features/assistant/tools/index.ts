import type { ToolSet } from 'ai';
import type { ToolContext } from '../lib/tool-context';
import { createComparePeriodsTool } from './compare-periods';
import { createFindAnomaliesTool } from './find-anomalies';
import { createGetBalancesTool } from './get-balances';
import { createGetBudgetStatusTool } from './get-budget-status';
import { createGetGoalsTool } from './get-goals';
import { createGetPeriodSummaryTool } from './get-period-summary';
import { createGetRecurringForecastTool } from './get-recurring-forecast';
import { createGetSpendingByCategoryTool } from './get-spending-by-category';
import { createGetSubscriptionsTool } from './get-subscriptions';
import { createGetTopMerchantsTool } from './get-top-merchants';
import { createGetTransactionsTool } from './get-transactions';
import { createGetTrendTool } from './get-trend';

export function createAssistantTools(ctx: ToolContext): ToolSet {
  return {
    getPeriodSummary: createGetPeriodSummaryTool(ctx),
    getSpendingByCategory: createGetSpendingByCategoryTool(ctx),
    comparePeriods: createComparePeriodsTool(ctx),
    getTransactions: createGetTransactionsTool(ctx),
    getTopMerchants: createGetTopMerchantsTool(ctx),
    getSubscriptions: createGetSubscriptionsTool(ctx),
    getBudgetStatus: createGetBudgetStatusTool(ctx),
    getGoals: createGetGoalsTool(ctx),
    getBalances: createGetBalancesTool(ctx),
    getRecurringForecast: createGetRecurringForecastTool(ctx),
    getTrend: createGetTrendTool(ctx),
    findAnomalies: createFindAnomaliesTool(ctx),
  };
}
