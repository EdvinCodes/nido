import type { RecurrenceFreq } from './lib/annualize';

export type SubscriptionCard = {
  id: string;
  name: string;
  merchant: string | null;
  amountMinor: number;
  currency: string;
  freq: RecurrenceFreq;
  intervalCount: number;
  nextRunOn: string;
  splitMode: string;
  totalPaidMinor: number;
  monthlyMinor: number;
  annualMinor: number;
  isActive: boolean;
  cancelledAt: string | null;
  cancelUrl: string | null;
  priceSpark: number[];
  cycleKey: string;
};

export type RecurringCandidate = {
  merchant: string;
  merchantKey: string;
  currency: string;
  amountMinor: number;
  suggestedFreq: RecurrenceFreq;
  suggestedInterval: number;
  categoryId: string | null;
  accountId: string | null;
  payerParticipantId: string | null;
  splitMode: string;
  firstOn: string;
  lastOn: string;
  transactionIds: string[];
};

export type GhostSubscription = {
  ruleId: string;
  name: string;
  merchant: string | null;
  amountMinor: number;
  currency: string;
  chargeCount: number;
  totalPaidMinor: number;
  monthsActive: number;
  cancelUrl: string | null;
};

export type UpcomingCharge = {
  ruleId: string;
  name: string;
  merchant: string | null;
  amountMinor: number;
  currency: string;
  on: string;
};

export type RuleDetail = SubscriptionCard & {
  kind: string;
  autoCreate: boolean;
  reminderDaysBefore: number;
  notes: string | null;
  charges: Array<{ id: string; bookedOn: string; amountMinor: number }>;
  priceChanges: Array<{
    id: string;
    oldAmountMinor: number;
    newAmountMinor: number;
    detectedOn: string;
  }>;
};
