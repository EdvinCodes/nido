'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { grantAiConsentAction, revokeAiConsentAction } from '@/features/assistant/actions';
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
  onGrant,
  onRevoke,
}: {
  spaceId: string;
  canManage: boolean;
  modelLabel: string | null;
  consentActive: boolean;
  useRealNames: boolean;
  retentionDays: number;
  provider: string | null;
  onGrant: typeof grantAiConsentAction;
  onRevoke: typeof revokeAiConsentAction;
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="font-medium">{t('provider')}</p>
        <p className="mt-1 text-muted-foreground">{modelLabel ?? t('unknownModel')}</p>
        {provider ? (
          <p className="mt-2 text-muted-foreground">{t('consentProvider', { provider })}</p>
        ) : null}
        <p className="mt-3 text-muted-foreground">{t('ollamaHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('retention')}</Label>
        <Select
          value={retentionDays}
          onValueChange={setRetentionDays}
          disabled={!canManage || consentActive}
        >
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
          disabled={!canManage || consentActive}
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
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              run(() => onRevoke({ spaceId }));
            }}
          >
            {t('revoke')}
          </Button>
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
