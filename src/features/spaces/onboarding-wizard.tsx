'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { TimezoneSelect } from '@/components/forms/timezone-select';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSpaceAction } from '@/features/spaces/actions';
import { DEFAULT_CATEGORY_OPTIONS } from '@/features/spaces/constants';
import type { SpaceKind } from '@/lib/auth';
import { route } from '@/lib/routes';

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function OnboardingWizard({ cancelHref }: { cancelHref?: Route | null }) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const step = Math.min(3, Math.max(1, Number(searchParams.get('step') ?? '1') || 1));
  const kind = (searchParams.get('kind') as SpaceKind | null) ?? null;
  const name = searchParams.get('name') ?? '';
  const currency = searchParams.get('currency') ?? 'EUR';
  const timezone = searchParams.get('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monthStartsOn = Number(searchParams.get('monthStartsOn') ?? '1') || 1;
  const participants = parseList(searchParams.get('participants'));
  const selectedCategories = useMemo(() => {
    const raw = searchParams.get('categories');
    if (raw === null) return DEFAULT_CATEGORY_OPTIONS.map((c) => c.key);
    return parseList(raw);
  }, [searchParams]);

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    router.push(`/onboarding?${params.toString()}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        {cancelHref ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={cancelHref}>{t('cancelToDashboard')}</Link>
          </Button>
        ) : (
          <span aria-hidden className="size-9" />
        )}
        <SignOutButton variant="ghost" size="sm" showIcon={false} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('stepOf', { step, total: 3 })}
        </p>
        <div className="flex gap-2" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">{t('step1Title')}</h2>
            <p className="text-sm text-muted-foreground">{t('step1Body')}</p>
          </div>
          {(
            [
              ['solo', 'kindSolo', 'kindSoloHint'],
              ['couple', 'kindCouple', 'kindCoupleHint'],
              ['shared', 'kindShared', 'kindSharedHint'],
            ] as const
          ).map(([value, titleKey, hintKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                pushParams({ kind: value, step: '2' });
              }}
              className={`w-full rounded-lg border px-4 py-4 text-left transition-colors ${
                kind === value ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/40'
              }`}
            >
              <p className="font-medium">{t(titleKey)}</p>
              <p className="text-sm text-muted-foreground">{t(hintKey)}</p>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">{t('step2Title')}</h2>
          <div className="space-y-2">
            <Label htmlFor="spaceName">{t('spaceName')}</Label>
            <Input
              id="spaceName"
              value={name}
              placeholder={t('spaceNamePlaceholder')}
              onChange={(e) => {
                pushParams({ name: e.target.value, step: '2' });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="currency">{t('currency')}</Label>
              <Input
                id="currency"
                value={currency}
                maxLength={3}
                onChange={(e) => {
                  pushParams({ currency: e.target.value.toUpperCase(), step: '2' });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthStartsOn">{t('monthStartsOn')}</Label>
              <Input
                id="monthStartsOn"
                type="number"
                min={1}
                max={28}
                value={monthStartsOn}
                onChange={(e) => {
                  pushParams({ monthStartsOn: e.target.value, step: '2' });
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t('timezone')}</Label>
            <TimezoneSelect
              id="timezone"
              value={timezone}
              onValueChange={(value) => {
                pushParams({ timezone: value, step: '2' });
              }}
            />
          </div>
          {kind !== 'solo' ? (
            <div className="space-y-2">
              <Label>{t('otherPeople')}</Label>
              <p className="text-xs text-muted-foreground">{t('otherPeopleHint')}</p>
              {participants.map((p, idx) => (
                <Input
                  key={idx}
                  value={p}
                  placeholder={t('participantPlaceholder')}
                  onChange={(e) => {
                    const next = [...participants];
                    next[idx] = e.target.value;
                    pushParams({ participants: next.filter(Boolean).join(','), step: '2' });
                  }}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  pushParams({
                    participants: [...participants, ''].join(','),
                    step: '2',
                  });
                }}
              >
                {t('addPerson')}
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                pushParams({ step: '1' });
              }}
            >
              {tCommon('back')}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!name.trim() || !kind}
              onClick={() => {
                pushParams({ step: '3', name: name.trim() });
              }}
            >
              {tCommon('continue')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">{t('step3Title')}</h2>
            <p className="text-sm text-muted-foreground">{t('step3Body')}</p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('expenseCategories')}</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CATEGORY_OPTIONS.filter((c) => c.kind === 'expense').map((c) => {
                const on = selectedCategories.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      const next = on
                        ? selectedCategories.filter((k) => k !== c.key)
                        : [...selectedCategories, c.key];
                      pushParams({ categories: next.join(','), step: '3' });
                    }}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      on ? 'border-primary bg-primary/15' : 'border-border opacity-60'
                    }`}
                  >
                    {t(`categories.${c.key}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-sm font-medium">{t('incomeCategories')}</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CATEGORY_OPTIONS.filter((c) => c.kind === 'income').map((c) => {
                const on = selectedCategories.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      const next = on
                        ? selectedCategories.filter((k) => k !== c.key)
                        : [...selectedCategories, c.key];
                      pushParams({ categories: next.join(','), step: '3' });
                    }}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      on ? 'border-primary bg-primary/15' : 'border-border opacity-60'
                    }`}
                  >
                    {t(`categories.${c.key}`)}
                  </button>
                );
              })}
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                pushParams({ step: '2' });
              }}
            >
              {tCommon('back')}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={pending || !kind}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const selectedKind = kind;
                  if (!selectedKind) {
                    return;
                  }
                  const result = await createSpaceAction({
                    name: name.trim() || 'Home',
                    kind: selectedKind,
                    currency,
                    timezone,
                    monthStartsOn,
                    weekStartsOn: 1,
                    participants: participants
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((displayName) => ({ displayName })),
                    categoryKeys: selectedCategories.length ? selectedCategories : null,
                  });
                  if (!result.ok) {
                    setError(result.error.message);
                    return;
                  }
                  router.push(route(`/s/${result.data.spaceId}`));
                  router.refresh();
                });
              }}
            >
              {t('finish')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
