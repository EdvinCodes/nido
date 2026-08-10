'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AmountInput } from '@/components/money/amount-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { createTransaction } from '@/features/transactions/actions';
import { useTransactionComposer } from '@/features/transactions/composer-context';
import { SplitEditor, type SplitEditorParticipant } from '@/features/transactions/split-editor';
import type { SplitParticipantInput } from '@/features/transactions/lib/compute-splits';
import type { SplitMode } from '@/features/transactions/lib/compute-splits';
import { validateSplit } from '@/features/transactions/lib/validate-split';
import { useSpaceContext } from '@/features/spaces/space-context';
import { useMediaQuery } from '@/lib/use-media-query';
import type { AccountRow } from '@/features/transactions/types';

type CategoryOption = {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: string;
  parent_id: string | null;
};

function todayIso(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftIsoDate(iso: string, days: number): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function TransactionComposerHost({
  categories,
  accounts,
  participants,
}: {
  categories: CategoryOption[];
  accounts: AccountRow[];
  participants: SplitEditorParticipant[];
}) {
  const { mode, close } = useTransactionComposer();
  const open = mode === 'create';
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const form = (
    <TransactionForm
      categories={categories}
      accounts={accounts}
      participants={participants}
      onDone={close}
    />
  );

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <ComposerTitle />
            </DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>
            <ComposerTitle />
          </SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-6">{form}</div>
      </SheetContent>
    </Sheet>
  );
}

function ComposerTitle() {
  const t = useTranslations('transactions');
  return <>{t('addTitle')}</>;
}

function TransactionForm({
  categories,
  accounts,
  participants,
  onDone,
}: {
  categories: CategoryOption[];
  accounts: AccountRow[];
  participants: SplitEditorParticipant[];
  onDone: () => void;
}) {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { space, participantId } = useSpaceContext();
  const [pending, startTransition] = useTransition();

  const defaultSplit: SplitMode = space.kind === 'solo' ? 'personal' : 'equal';
  const defaultSelected: SplitParticipantInput[] =
    defaultSplit === 'personal'
      ? [{ participantId, weight: 1, position: 0 }]
      : participants.map((p) => ({
          participantId: p.id,
          weight: 1,
          position: p.position,
        }));

  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string>('');
  const [bookedOn, setBookedOn] = useState(() => todayIso(space.timezone));
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '');
  const [payerId, setPayerId] = useState(participantId);
  const [splitMode, setSplitMode] = useState<SplitMode>(defaultSplit);
  const [selected, setSelected] = useState<SplitParticipantInput[]>(defaultSelected);
  const [advanced, setAdvanced] = useState(false);

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) => {
        if (kind === 'expense') return c.kind === 'expense' || c.kind === 'both';
        if (kind === 'income') return c.kind === 'income' || c.kind === 'both';
        return false;
      }),
    [categories, kind],
  );

  const splitOk =
    kind === 'transfer' ||
    (amountMinor != null &&
      amountMinor > 0 &&
      validateSplit(splitMode, selected, BigInt(amountMinor)).ok);

  const canSave =
    amountMinor != null &&
    amountMinor > 0 &&
    (kind === 'transfer'
      ? Boolean(accountId && toAccountId && accountId !== toAccountId)
      : Boolean(categoryId && payerId && splitOk));

  function save(): void {
    if (amountMinor == null || amountMinor <= 0) return;
    if (!canSave) return;
    startTransition(async () => {
      const result = await createTransaction({
        spaceId: space.id,
        requestId: crypto.randomUUID(),
        kind,
        amountMinor,
        currency: space.base_currency,
        bookedOn,
        description: description || undefined,
        merchant: merchant || null,
        notes: notes || null,
        categoryId: kind === 'transfer' ? null : categoryId || null,
        accountId: accountId || null,
        toAccountId: kind === 'transfer' ? toAccountId || null : null,
        payerParticipantId: kind === 'transfer' ? null : payerId || null,
        splitMode: kind === 'transfer' ? 'personal' : splitMode,
        participants:
          kind === 'transfer'
            ? []
            : selected.map((p) => {
                const row: {
                  participantId: string;
                  weight?: number;
                  owedMinor?: number;
                } = { participantId: p.participantId };
                if (p.weight !== undefined) row.weight = p.weight;
                if (p.owedMinor != null) row.owedMinor = Number(p.owedMinor);
                return row;
              }),
        tagIds: [],
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t('created'));
      onDone();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex gap-1">
        {(['expense', 'income', 'transfer'] as const).map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={kind === k ? 'default' : 'outline'}
            onClick={() => {
              setKind(k);
            }}
          >
            {t(`kind.${k}`)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-amount">{t('amount')}</Label>
        <AmountInput
          id="tx-amount"
          currency={space.base_currency}
          locale={locale}
          valueMinor={amountMinor}
          onValueChange={setAmountMinor}
          aria-label={t('amount')}
        />
      </div>

      {kind !== 'transfer' ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t('category')}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={t('categoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t('fromAccount')}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t('accountPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('toAccount')}</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t('accountPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={bookedOn === todayIso(space.timezone) ? 'default' : 'outline'}
          onClick={() => {
            setBookedOn(todayIso(space.timezone));
          }}
        >
          {t('today')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setBookedOn(shiftIsoDate(todayIso(space.timezone), -1));
          }}
        >
          {t('yesterday')}
        </Button>
        <Input
          type="date"
          className="h-8 w-auto"
          value={bookedOn}
          onChange={(e) => {
            setBookedOn(e.target.value);
          }}
        />
      </div>

      {kind !== 'transfer' && participants.length > 0 ? (
        <SplitEditor
          amountMinor={amountMinor ?? 0}
          currency={space.base_currency}
          locale={locale}
          mode={splitMode}
          onModeChange={setSplitMode}
          participants={participants}
          selected={selected}
          onSelectedChange={setSelected}
        />
      ) : null}

      <button
        type="button"
        className="text-left text-sm text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => {
          setAdvanced((v) => !v);
        }}
      >
        {advanced ? t('hideDetails') : t('moreDetails')}
      </button>

      {advanced ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-desc">{t('description')}</Label>
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-merchant">{t('merchant')}</Label>
            <Input
              id="tx-merchant"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
              }}
              maxLength={120}
            />
          </div>
          {kind !== 'transfer' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t('account')}</Label>
                <Select
                  value={accountId || '__none__'}
                  onValueChange={(v) => {
                    setAccountId(v === '__none__' ? '' : v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('accountPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('noAccount')}</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('payer')}</Label>
                <Select value={payerId} onValueChange={setPayerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-notes">{t('notes')}</Label>
            <Input
              id="tx-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              maxLength={2000}
            />
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={!canSave || pending} className="w-full">
        {pending ? tCommon('loading') : tCommon('save')}
      </Button>
    </form>
  );
}
