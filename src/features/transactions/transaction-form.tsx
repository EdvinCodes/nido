'use client';

import { Sparkles } from 'lucide-react';
import { useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AmountInput } from '@/components/money/amount-input';
import { CurrencySelect } from '@/components/money/currency-select';
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
import {
  AttachmentPicker,
  type AttachmentPickerHandle,
} from '@/features/attachments/attachment-picker';
import { invokeReceiptExtract } from '@/features/attachments/lib/invoke-extract';
import { pollReceiptExtraction } from '@/features/attachments/lib/poll-ocr';
import { enqueuePendingTransaction } from '@/features/offline/db';
import { useOfflineOptional } from '@/features/offline/offline-provider';
import { createTransaction } from '@/features/transactions/actions';
import { useTransactionComposer } from '@/features/transactions/composer-context';
import { buildOptimisticTransaction } from '@/features/transactions/lib/build-optimistic-transaction';
import { SplitEditor, type SplitEditorParticipant } from '@/features/transactions/split-editor';
import type { SplitParticipantInput } from '@/features/transactions/lib/compute-splits';
import type { SplitMode } from '@/features/transactions/lib/compute-splits';
import { validateSplit } from '@/features/transactions/lib/validate-split';
import { useSpaceContext } from '@/features/spaces/space-context';
import { useMediaQuery } from '@/lib/use-media-query';
import type { AccountRow } from '@/features/transactions/types';
import { useQueryClient } from '@tanstack/react-query';
import { transactionsQueryKey } from '@/features/transactions/hooks';
import { cn } from '@/lib/utils';
import { hapticSuccess } from '@/lib/haptics';
import { KeyboardAwareScroll } from '@/components/mobile/keyboard-aware-scroll';

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
  recentCurrencies,
  isAiConfigured,
}: {
  categories: CategoryOption[];
  accounts: AccountRow[];
  participants: SplitEditorParticipant[];
  recentCurrencies: string[];
  isAiConfigured: boolean;
}) {
  const { mode, close } = useTransactionComposer();
  const open = mode === 'create' || mode === 'scan';
  const scanMode = mode === 'scan';
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const form = (
    <TransactionForm
      categories={categories}
      accounts={accounts}
      participants={participants}
      recentCurrencies={recentCurrencies}
      onDone={close}
      scanMode={scanMode}
      isAiConfigured={isAiConfigured}
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
              <ComposerTitle scanMode={scanMode} />
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
            <ComposerTitle scanMode={scanMode} />
          </SheetTitle>
        </SheetHeader>
        <KeyboardAwareScroll>
          <div className="px-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{form}</div>
        </KeyboardAwareScroll>
      </SheetContent>
    </Sheet>
  );
}

function ComposerTitle({ scanMode }: { scanMode: boolean }) {
  const t = useTranslations('transactions');
  const tAttachments = useTranslations('attachments');
  return <>{scanMode ? tAttachments('scanTitle') : t('addTitle')}</>;
}

function SuggestedLabel({ children, suggested }: { children: ReactNode; suggested?: boolean }) {
  if (!suggested) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Sparkles className="size-3 text-primary" aria-hidden />
    </span>
  );
}

function TransactionForm({
  categories,
  accounts,
  participants,
  recentCurrencies,
  onDone,
  scanMode = false,
  isAiConfigured = false,
}: {
  categories: CategoryOption[];
  accounts: AccountRow[];
  participants: SplitEditorParticipant[];
  recentCurrencies: string[];
  onDone: () => void;
  scanMode?: boolean;
  isAiConfigured?: boolean;
}) {
  const t = useTranslations('transactions');
  const tAttachments = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { space, participantId, userId } = useSpaceContext();
  const { insertOptimistic, clearOptimistic } = useTransactionComposer();
  const offline = useOfflineOptional();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const pickerRef = useRef<AttachmentPickerHandle>(null);

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
  const [currency, setCurrency] = useState(space.base_currency);
  const [manualRate, setManualRate] = useState('');
  const [useManualRate, setUseManualRate] = useState(false);
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
  const [advanced, setAdvanced] = useState(scanMode);
  const [extracting, setExtracting] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [suggestedFields, setSuggestedFields] = useState({
    amount: false,
    category: false,
    bookedOn: false,
    merchant: false,
  });

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

  function clearSuggestions(): void {
    setHasSuggestions(false);
    setSuggestedFields({
      amount: false,
      category: false,
      bookedOn: false,
      merchant: false,
    });
  }

  async function runExtraction(attachmentId: string): Promise<void> {
    if (!isAiConfigured) return;
    setExtracting(true);
    try {
      await invokeReceiptExtract({
        attachmentId,
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
      });
      const result = await pollReceiptExtraction(attachmentId);
      if (!result) return;

      const nextSuggested = {
        amount: false,
        category: false,
        bookedOn: false,
        merchant: false,
      };

      if (result.total_minor != null) {
        setAmountMinor(result.total_minor);
        nextSuggested.amount = true;
      }
      if (result.booked_on) {
        setBookedOn(result.booked_on);
        nextSuggested.bookedOn = true;
      }
      if (result.merchant) {
        setMerchant(result.merchant);
        setAdvanced(true);
        nextSuggested.merchant = true;
      }
      if (result.category_id) {
        setCategoryId(result.category_id);
        nextSuggested.category = true;
      }

      setSuggestedFields(nextSuggested);
      setHasSuggestions(Object.values(nextSuggested).some(Boolean));
    } finally {
      setExtracting(false);
    }
  }

  function save(): void {
    if (amountMinor == null || amountMinor <= 0) return;
    if (!canSave) return;

    const category = filteredCategories.find((c) => c.id === categoryId) ?? null;
    const account = accounts.find((a) => a.id === accountId) ?? null;
    const toAccount = accounts.find((a) => a.id === toAccountId) ?? null;
    const payer = participants.find((p) => p.id === payerId) ?? null;
    const clientId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const optimisticId = `optimistic-${clientId}`;
    const optimisticTx = buildOptimisticTransaction({
      id: optimisticId,
      spaceId: space.id,
      userId,
      kind,
      amountMinor,
      currency,
      bookedOn,
      description: description || merchant || t(`kind.${kind}`),
      merchant,
      category,
      account: kind === 'transfer' ? account : (account ?? null),
      toAccount: kind === 'transfer' ? toAccount : null,
      payer: kind === 'transfer' ? null : (payer ?? null),
      splitMode: kind === 'transfer' ? 'personal' : splitMode,
      selected: kind === 'transfer' ? [] : selected,
      participants,
    });

    const input = {
      spaceId: space.id,
      requestId,
      kind,
      amountMinor,
      currency,
      bookedOn,
      description: description || undefined,
      merchant: merchant || null,
      notes: notes || null,
      ...(useManualRate && manualRate
        ? { baseRateManual: true, baseRate: Number(manualRate) }
        : {}),
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
      tagIds: [] as string[],
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      insertOptimistic({ ...optimisticTx, sync_status: 'pending' });
      void (async () => {
        await enqueuePendingTransaction({
          clientId,
          requestId,
          spaceId: space.id,
          createdAt: new Date().toISOString(),
          input,
          optimistic: { ...optimisticTx, sync_status: 'pending' },
          status: 'pending',
        });
        await offline?.refreshPending();
        hapticSuccess();
        toast.success(t('savedOffline'));
        onDone();
      })();
      return;
    }

    insertOptimistic(optimisticTx);

    startTransition(async () => {
      const result = await createTransaction(input);

      clearOptimistic();

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      const txId = result.data.id;
      await pickerRef.current?.linkToTransaction(txId);

      hapticSuccess();
      toast.success(t('created'));
      await queryClient.invalidateQueries({ queryKey: transactionsQueryKey(space.id, {}) });
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
      {scanMode && isAiConfigured && extracting ? (
        <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-muted-foreground">
          {tAttachments('extracting')}
        </p>
      ) : null}

      {hasSuggestions ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={clearSuggestions}
        >
          {tAttachments('clearSuggestions')}
        </Button>
      ) : null}

      {!scanMode ? (
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
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-amount">
          <SuggestedLabel suggested={suggestedFields.amount}>{t('amount')}</SuggestedLabel>
        </Label>
        <div className="flex gap-2">
          <AmountInput
            id="tx-amount"
            currency={currency}
            locale={locale}
            valueMinor={amountMinor}
            onValueChange={(value) => {
              clearSuggestions();
              setAmountMinor(value);
              setSuggestedFields((prev) => ({ ...prev, amount: false }));
            }}
            aria-label={t('amount')}
            className={cn('flex-1', suggestedFields.amount && 'ring-1 ring-primary/40')}
          />
          <CurrencySelect
            value={currency}
            onValueChange={setCurrency}
            baseCurrency={space.base_currency}
            recentCurrencies={recentCurrencies}
            className="w-[110px]"
          />
        </div>
      </div>

      {currency !== space.base_currency ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useManualRate}
              onChange={(e) => {
                setUseManualRate(e.target.checked);
              }}
            />
            {t('manualRate')}
          </label>
          {useManualRate ? (
            <Input
              inputMode="decimal"
              placeholder={t('manualRatePlaceholder')}
              value={manualRate}
              onChange={(e) => {
                setManualRate(e.target.value);
              }}
              aria-label={t('manualRate')}
            />
          ) : null}
        </div>
      ) : null}

      {kind !== 'transfer' ? (
        <div className="flex flex-col gap-1.5">
          <Label>
            <SuggestedLabel suggested={suggestedFields.category}>{t('category')}</SuggestedLabel>
          </Label>
          <Select
            value={categoryId}
            onValueChange={(value) => {
              clearSuggestions();
              setCategoryId(value);
              setSuggestedFields((prev) => ({ ...prev, category: false }));
            }}
          >
            <SelectTrigger
              aria-label={t('category')}
              className={cn(suggestedFields.category && 'ring-1 ring-primary/40')}
            >
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
              <SelectTrigger aria-label={t('fromAccount')}>
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
              <SelectTrigger aria-label={t('toAccount')}>
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
            setSuggestedFields((prev) => ({ ...prev, bookedOn: false }));
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
            setSuggestedFields((prev) => ({ ...prev, bookedOn: false }));
          }}
        >
          {t('yesterday')}
        </Button>
        <Input
          type="date"
          className={cn('h-8 w-auto', suggestedFields.bookedOn && 'ring-1 ring-primary/40')}
          value={bookedOn}
          onChange={(e) => {
            setBookedOn(e.target.value);
            setSuggestedFields((prev) => ({ ...prev, bookedOn: false }));
          }}
          aria-label={t('date')}
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
            <Label htmlFor="tx-merchant">
              <SuggestedLabel suggested={suggestedFields.merchant}>{t('merchant')}</SuggestedLabel>
            </Label>
            <Input
              id="tx-merchant"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                setSuggestedFields((prev) => ({ ...prev, merchant: false }));
              }}
              maxLength={120}
              className={cn(suggestedFields.merchant && 'ring-1 ring-primary/40')}
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

      <AttachmentPicker
        ref={pickerRef}
        spaceId={space.id}
        disabled={pending}
        cameraFirst={scanMode}
        autoOpen={scanMode}
        onFirstUploadComplete={(attachmentId) => {
          if (scanMode && isAiConfigured) {
            void runExtraction(attachmentId);
          }
        }}
      />

      <Button type="submit" disabled={!canSave || pending} className="w-full">
        {pending ? tCommon('loading') : tCommon('save')}
      </Button>
    </form>
  );
}
