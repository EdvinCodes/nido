'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CurrencySelect } from '@/components/money/currency-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateBaseCurrencyAction } from '@/features/reports/actions';
import { can, type MemberRole } from '@/lib/auth';

export function SpaceSettingsForm({
  spaceId,
  role,
  baseCurrency,
  recentCurrencies,
}: {
  spaceId: string;
  role: MemberRole;
  baseCurrency: string;
  recentCurrencies: string[];
}) {
  const t = useTranslations('settings.space');
  const [currency, setCurrency] = useState(baseCurrency);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canEdit = can(role, 'space.update');

  function save(): void {
    startTransition(async () => {
      const result = await updateBaseCurrencyAction({ spaceId, baseCurrency: currency });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t('baseCurrencyUpdated'));
      setConfirmOpen(false);
    });
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>

      <div className="max-w-sm space-y-2">
        <label className="text-sm font-medium">{t('baseCurrency')}</label>
        <CurrencySelect
          value={currency}
          onValueChange={setCurrency}
          baseCurrency={baseCurrency}
          recentCurrencies={recentCurrencies}
          disabled={!canEdit}
        />
        {canEdit ? (
          <Button
            disabled={pending || currency === baseCurrency}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            {t('saveBaseCurrency')}
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmBaseCurrencyTitle')}</DialogTitle>
            <DialogDescription>{t('confirmBaseCurrencyBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              {t('cancel')}
            </Button>
            <Button disabled={pending} onClick={save}>
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
