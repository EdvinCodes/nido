'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isContributor, type MemberRole } from '@/lib/auth';
import { route } from '@/lib/routes';
import { cancelSubscription } from './actions';
import type { RuleDetail } from './types';

export function SubscriptionDetailClient({
  spaceId,
  role,
  detail,
}: {
  spaceId: string;
  role: MemberRole;
  detail: RuleDetail;
}) {
  const t = useTranslations('subscriptions');
  const canEdit = isContributor(role);
  const [cancelUrl, setCancelUrl] = useState(detail.cancelUrl ?? '');
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 space-y-2 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <Link
          href={route(`/s/${spaceId}/subscriptions`)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t('back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{detail.name}</h1>
        <p className="text-sm text-muted-foreground">
          <Amount minor={detail.amountMinor} currency={detail.currency} /> · {detail.freq} ·{' '}
          {t('next', { date: detail.nextRunOn })}
        </p>
      </header>

      <div className="grid flex-1 gap-6 p-4 lg:grid-cols-2 lg:p-8">
        <section className="space-y-2">
          <h2 className="text-sm font-medium">{t('charges')}</h2>
          <ul className="space-y-2">
            {detail.charges.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t('noCharges')}</li>
            ) : (
              detail.charges.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <span>{c.bookedOn}</span>
                  <Amount minor={c.amountMinor} currency={detail.currency} />
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">{t('priceHistory')}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {detail.priceChanges.length === 0 ? (
                <li className="text-muted-foreground">{t('noPriceChanges')}</li>
              ) : (
                detail.priceChanges.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{p.detectedOn}</span>
                    <span>
                      <Amount minor={p.oldAmountMinor} currency={detail.currency} />
                      {' → '}
                      <Amount minor={p.newAmountMinor} currency={detail.currency} />
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-medium">{t('split')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{detail.splitMode}</p>
          </div>

          {canEdit && detail.isActive ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <h2 className="text-sm font-medium">{t('cancel')}</h2>
              <div className="space-y-1.5">
                <Label htmlFor="cancel-url">{t('fields.cancelUrl')}</Label>
                <Input
                  id="cancel-url"
                  value={cancelUrl}
                  onChange={(e) => {
                    setCancelUrl(e.target.value);
                  }}
                  placeholder="https://"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await cancelSubscription({
                      spaceId,
                      ruleId: detail.id,
                      cancelUrl: cancelUrl || null,
                    });
                  });
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
