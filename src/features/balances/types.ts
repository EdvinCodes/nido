import type { SettlementMethod } from './schemas';

export type ParticipantBalance = {
  participantId: string;
  displayName: string;
  color: string;
  position: number;
  userId: string | null;
  paidMinor: number;
  owedMinor: number;
  netMinor: number;
};

export type PairwiseBalance = {
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
};

export type SimplifiedPlanRow = {
  fromId: string;
  toId: string;
  amountMinor: number;
};

export type SettlementRow = {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
  currency: string;
  method: SettlementMethod | null;
  note: string | null;
  settledOn: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  disputedAt: string | null;
  disputeNote: string | null;
  reversedAt: string | null;
  reverseOfId: string | null;
  createdBy: string;
  createdAt: string;
};

export type BalanceBreakdownRow = {
  transactionId: string;
  bookedOn: string;
  kind: string;
  description: string | null;
  merchant: string | null;
  amountMinor: number;
  currency: string;
  paidMinor: number;
  owedMinor: number;
  deltaMinor: number;
};

export type BalancesPageModel = {
  balances: ParticipantBalance[];
  pairwise: PairwiseBalance[];
  simplified: SimplifiedPlanRow[];
  settlements: SettlementRow[];
  pendingForMe: SettlementRow[];
  currency: string;
};
