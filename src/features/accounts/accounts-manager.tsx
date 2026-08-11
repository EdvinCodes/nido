'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Amount } from '@/components/money/amount';
import { ConvertedAmount } from '@/components/money/converted-amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { can, type MemberRole } from '@/lib/auth';
import {
  archiveAccount,
  createAccount,
  reorderAccounts,
  updateAccount,
} from '@/features/accounts/actions';
import type { AccountRow } from '@/features/transactions/types';

function SortableRow({
  account,
  balanceMinor,
  baseCurrency,
  baseEquivalent,
  canEdit,
  onRename,
  onArchive,
}: {
  account: AccountRow;
  balanceMinor: number | null;
  baseCurrency: string;
  baseEquivalent?: { baseMinor: number; rate: number; asOf: string };
  canEdit: boolean;
  onRename: (name: string) => void;
  onArchive: () => void;
}) {
  const t = useTranslations('accounts');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: account.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2"
    >
      {canEdit ? (
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: account.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <Input
          className="h-8"
          defaultValue={account.name}
          disabled={!canEdit}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== account.name) {
              onRename(e.target.value.trim());
            }
          }}
        />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t(`kind.${account.kind}`)}
          {balanceMinor != null ? (
            <>
              {' · '}
              <Amount minor={balanceMinor} currency={account.currency} className="inline text-xs" />
              {account.currency !== baseCurrency && baseEquivalent ? (
                <>
                  {' · '}
                  <ConvertedAmount
                    baseMinor={baseEquivalent.baseMinor}
                    baseCurrency={baseCurrency}
                    originalMinor={balanceMinor}
                    originalCurrency={account.currency}
                    baseRate={baseEquivalent.rate}
                    rateAsOf={baseEquivalent.asOf}
                    className="inline text-xs text-muted-foreground"
                  />
                </>
              ) : null}
            </>
          ) : null}
        </p>
      </div>
      {canEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={onArchive}>
          {t('archive')}
        </Button>
      ) : null}
    </li>
  );
}

export function AccountsManager({
  spaceId,
  role,
  initial,
  balances,
  baseCurrency,
  baseBalances,
}: {
  spaceId: string;
  role: MemberRole;
  initial: AccountRow[];
  balances: Record<string, number>;
  baseCurrency: string;
  baseBalances: Record<string, { baseMinor: number; rate: number; asOf: string }>;
}) {
  const t = useTranslations('accounts');
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const canEdit = can(role, 'accounts.update');
  const canCreate = can(role, 'accounts.create');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sorted = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !canEdit) return;
    const oldIndex = sorted.findIndex((a) => a.id === active.id);
    const newIndex = sorted.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sorted, oldIndex, newIndex).map((a, position) => ({
      ...a,
      position,
    }));
    setItems(next);
    startTransition(async () => {
      await reorderAccounts({
        spaceId,
        items: next.map((a) => ({ id: a.id, position: a.position })),
      });
    });
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        {canCreate ? (
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await createAccount({
                  spaceId,
                  name: t('newAccount'),
                  kind: 'bank',
                });
                if (result.ok) {
                  setItems((prev) => [
                    ...prev,
                    {
                      id: result.data.id,
                      space_id: spaceId,
                      name: t('newAccount'),
                      kind: 'bank',
                      currency: 'EUR',
                      owner_participant_id: null,
                      opening_balance_minor: 0,
                      color: '#5B8A7A',
                      icon: 'wallet',
                      include_in_totals: true,
                      position: prev.length,
                      archived_at: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  ]);
                }
              });
            }}
          >
            {t('add')}
          </Button>
        ) : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sorted.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {sorted.map((account) => (
              <SortableRow
                key={account.id}
                account={account}
                balanceMinor={balances[account.id] ?? null}
                baseCurrency={baseCurrency}
                {...(baseBalances[account.id] ? { baseEquivalent: baseBalances[account.id] } : {})}
                canEdit={canEdit}
                onRename={(name) => {
                  startTransition(async () => {
                    await updateAccount({ spaceId, accountId: account.id, name });
                    setItems((prev) => prev.map((a) => (a.id === account.id ? { ...a, name } : a)));
                  });
                }}
                onArchive={() => {
                  startTransition(async () => {
                    await archiveAccount({ spaceId, accountId: account.id, archived: true });
                    setItems((prev) => prev.filter((a) => a.id !== account.id));
                  });
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
