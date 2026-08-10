import { computeSplits } from '@/features/transactions/lib/compute-splits';
import type { SplitMode, SplitParticipantInput } from '@/features/transactions/lib/compute-splits';
import type { TransactionView } from '@/features/transactions/types';

type BuildOptimisticInput = {
  id: string;
  spaceId: string;
  userId: string;
  kind: 'expense' | 'income' | 'transfer';
  amountMinor: number;
  currency: string;
  bookedOn: string;
  description: string;
  merchant: string;
  category?: CategoryOption | null;
  account?: AccountOption | null;
  toAccount?: AccountOption | null;
  payer?: ParticipantOption | null;
  splitMode: SplitMode;
  selected: SplitParticipantInput[];
  participants: ParticipantOption[];
};

type CategoryOption = { id: string; name: string; color: string; icon: string };
type AccountOption = { id: string; name: string; color: string };
type ParticipantOption = { id: string; displayName: string; color: string };

export function buildOptimisticTransaction(input: BuildOptimisticInput): TransactionView {
  const now = new Date().toISOString();
  const splits =
    input.kind === 'transfer' || input.selected.length === 0
      ? []
      : computeSplits(BigInt(input.amountMinor), input.splitMode, input.selected).map((row) => {
          const meta = input.participants.find((p) => p.id === row.participantId);
          return {
            id: `${input.id}-${row.participantId}`,
            participant_id: row.participantId,
            display_name: meta?.displayName ?? '',
            color: meta?.color ?? '#888',
            avatar_url: null,
            weight: row.weight,
            owed_minor: Number(row.owedMinor),
            base_owed_minor: Number(row.owedMinor),
          };
        });

  return {
    id: input.id,
    space_id: input.spaceId,
    kind: input.kind,
    booked_on: input.bookedOn,
    occurred_at: null,
    amount_minor: input.amountMinor,
    currency: input.currency,
    base_amount_minor: input.amountMinor,
    base_rate: 1,
    description: input.description,
    merchant: input.merchant || null,
    notes: null,
    category_id: input.category?.id ?? null,
    account_id: input.account?.id ?? null,
    to_account_id: input.toAccount?.id ?? null,
    payer_participant_id: input.payer?.id ?? null,
    split_mode: input.splitMode,
    external_id: null,
    is_pending: false,
    created_by: input.userId,
    created_at: now,
    updated_at: now,
    category_name: input.category?.name ?? null,
    category_color: input.category?.color ?? null,
    category_icon: input.category?.icon ?? null,
    account_name: input.account?.name ?? null,
    account_color: input.account?.color ?? null,
    to_account_name: input.toAccount?.name ?? null,
    payer_name: input.payer?.displayName ?? null,
    payer_color: input.payer?.color ?? null,
    payer_avatar_url: null,
    splits,
    tags: [],
  };
}
