'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type {
  grantAiConsentAction,
  revokeAiConsentAction,
  updateAiPreferencesAction,
} from '@/features/assistant/actions';
import type { MonthlyTokenUsage } from '@/features/assistant/queries';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Button } from '@/components/ui/button';

export function AiSettingsClient({
  spaceId,
  canManage,
  modelLabel,
  consentActive,
  useRealNames: initialRealNames,
  retentionDays: initialRetention,
  provider,
  usage,
  onGrant,
  onRevoke,
  onUpdatePreferences,
}: {
  spaceId: string;
  canManage: boolean;
  modelLabel: string | null;
  consentActive: boolean;
  useRealNames: boolean;
  retentionDays: number;
  provider: string | null;
  usage: MonthlyTokenUsage;
  onGrant: typeof grantAiConsentAction;
  onRevoke: typeof revokeAiConsentAction;
  onUpdatePreferences: typeof updateAiPreferencesAction;
}) {
  const t = useTranslations('assistant.settings');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [useRealNames, setUseRealNames] = useState(initialRealNames);
  const [retentionDays, setRetentionDays] = useState(String(initialRetention));
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>): void {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(t('saved'));
        router.refresh();
      } else if (result.error) {
        setMessage(result.error.message);
      }
    });
  }

  const costLabel =
    usage.estimatedCostUsd == null
      ? t('usageLocal')
      : t('usageCost', {
          amount: String(Math.round(usage.estimatedCostUsd * 10_000) / 10_000),
        });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="font-medium">{t('provider')}</p>
        <p className="mt-1 text-muted-foreground">{modelLabel ?? t('unknownModel')}</p>
        {provider ? (
          <p className="mt-2 text-muted-foreground">{t('consentProvider', { provider })}</p>
        ) : (
          <p className="mt-2 text-muted-foreground">
            {t('consentProvider', { provider: modelLabel?.split('/')[0] ?? 'configured' })}
          </p>
        )}
        <p className="mt-3 text-muted-foreground">{t('ollamaHint')}</p>
        <p className="mt-2 text-muted-foreground">{t('ollamaSetup')}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="font-medium">{t('usageTitle')}</p>
        <p className="mt-1 text-muted-foreground">
          {t('usageBody', {
            messages: usage.messageCount,
            tokens: usage.totalTokens,
          })}
        </p>
        <p className="mt-1 text-muted-foreground">{costLabel}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('retention')}</Label>
        <Select value={retentionDays} onValueChange={setRetentionDays} disabled={!canManage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="90">90</SelectItem>
            <SelectItem value="180">180</SelectItem>
            <SelectItem value="365">365</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={useRealNames}
          disabled={!canManage}
          onChange={(e) => {
            setUseRealNames(e.target.checked);
          }}
        />
        <span>{t('realNames')}</span>
      </label>

      <p className="text-sm text-muted-foreground">{t('consentBody')}</p>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {canManage ? (
        consentActive ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                run(() =>
                  onUpdatePreferences({
                    spaceId,
                    useRealNames,
                    retentionDays: Number(retentionDays),
                  }),
                );
              }}
            >
              {t('savePreferences')}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                run(() => onRevoke({ spaceId }));
              }}
            >
              {t('revoke')}
            </Button>
          </div>
        ) : (
          <Button
            disabled={pending}
            onClick={() => {
              run(() =>
                onGrant({
                  spaceId,
                  useRealNames,
                  retentionDays: Number(retentionDays),
                }),
              );
            }}
          >
            {t('grant')}
          </Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">{t('adminOnly')}</p>
      )}
    </div>
  );
}
