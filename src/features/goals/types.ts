export type GoalStatus = 'active' | 'reached' | 'paused' | 'archived';

export type GoalProjection = {
  goalId: string;
  remainingMinor: number;
  requiredMonthlyMinor: number | null;
  averageMonthlyMinor: number;
  projectedCompletionOn: string | null;
  onPace: boolean | null;
  targetDate: string | null;
  targetPassed: boolean;
};

export type GoalCardModel = {
  id: string;
  name: string;
  description: string | null;
  targetMinor: number;
  savedMinor: number;
  currency: string;
  targetDate: string | null;
  accountId: string | null;
  accountName: string | null;
  color: string;
  icon: string;
  status: GoalStatus;
  projection: GoalProjection;
};

export type GoalContributionRow = {
  id: string;
  amountMinor: number;
  contributedOn: string;
  note: string | null;
  participantId: string;
  participantName: string;
  transactionId: string | null;
};

export type GoalDetailModel = GoalCardModel & {
  contributions: GoalContributionRow[];
  byParticipant: Array<{ participantId: string; participantName: string; totalMinor: number }>;
  cumulative: Array<{ on: string; savedMinor: number }>;
};
