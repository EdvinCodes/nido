'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendTestNotification, updateNotificationPreference, updateQuietHours } from './actions';
import { PushPermissionCard } from './push-permission-card';
import type { PreferenceRow, QuietHoursRow } from './queries';

function minuteToTime(minute: number): string {
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, '0');
  const m = (minute % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinute(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function NotificationsSettings({
  spaceId,
  preferences,
  quietHours,
  emailConfigured,
  pushConfigured,
  vapidPublicKey,
}: {
  spaceId: string;
  preferences: PreferenceRow[];
  quietHours: QuietHoursRow | null;
  emailConfigured: boolean;
  pushConfigured: boolean;
  vapidPublicKey: string | null;
}) {
  const t = useTranslations('notifications');
  const [pending, startTransition] = useTransition();

  const qh = quietHours ?? {
    enabled: false,
    startMinute: 1320,
    endMinute: 480,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return (
    <div className="space-y-8 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('settingsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settingsBody')}</p>
      </div>

      <PushPermissionCard
        spaceId={spaceId}
        vapidPublicKey={vapidPublicKey}
        pushConfigured={pushConfigured}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('quietHoursTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('quietHoursBody')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={qh.enabled}
            disabled={pending}
            onChange={(e) => {
              startTransition(async () => {
                await updateQuietHours({
                  spaceId,
                  enabled: e.target.checked,
                  startMinute: qh.startMinute,
                  endMinute: qh.endMinute,
                  timezone: qh.timezone,
                });
              });
            }}
          />
          {t('quietHoursEnabled')}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="qh-start">{t('quietHoursStart')}</Label>
            <Input
              id="qh-start"
              type="time"
              defaultValue={minuteToTime(qh.startMinute)}
              disabled={pending}
              onChange={(e) => {
                startTransition(async () => {
                  await updateQuietHours({
                    spaceId,
                    enabled: qh.enabled,
                    startMinute: timeToMinute(e.target.value),
                    endMinute: qh.endMinute,
                    timezone: qh.timezone,
                  });
                });
              }}
            />
          </div>
          <div>
            <Label htmlFor="qh-end">{t('quietHoursEnd')}</Label>
            <Input
              id="qh-end"
              type="time"
              defaultValue={minuteToTime(qh.endMinute)}
              disabled={pending}
              onChange={(e) => {
                startTransition(async () => {
                  await updateQuietHours({
                    spaceId,
                    enabled: qh.enabled,
                    startMinute: qh.startMinute,
                    endMinute: timeToMinute(e.target.value),
                    timezone: qh.timezone,
                  });
                });
              }}
            />
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t('columns.kind')}</th>
              <th className="px-3 py-2 font-medium">{t('columns.inApp')}</th>
              <th className="px-3 py-2 font-medium">{t('columns.email')}</th>
              <th className="px-3 py-2 font-medium">{t('columns.push')}</th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((pref) => (
              <tr key={pref.kind} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{t(`kinds.${pref.kind}`)}</td>
                <td className="px-3 py-2">
                  <ChannelToggle
                    checked={pref.inApp}
                    disabled={pending}
                    onChange={(inApp) => {
                      startTransition(async () => {
                        await updateNotificationPreference({ spaceId, kind: pref.kind, inApp });
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  {emailConfigured ? (
                    <ChannelToggle
                      checked={pref.email}
                      disabled={pending}
                      onChange={(email) => {
                        startTransition(async () => {
                          await updateNotificationPreference({ spaceId, kind: pref.kind, email });
                        });
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('emailUnavailable')}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {pushConfigured ? (
                    <ChannelToggle
                      checked={pref.push}
                      disabled={pending}
                      onChange={(push) => {
                        startTransition(async () => {
                          await updateNotificationPreference({ spaceId, kind: pref.kind, push });
                        });
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('pushUnavailable')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('testTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <TestButton
            label={t('testInApp')}
            disabled={pending}
            onClick={() => {
              toast.success(t('testInAppSent'));
            }}
          />
          <TestButton
            label={t('testPush')}
            disabled={pending || !pushConfigured}
            onClick={() => {
              startTransition(async () => {
                const result = await sendTestNotification({ spaceId, channel: 'push' });
                if (result.ok) toast.success(t('testPushSent'));
                else toast.error(result.error.message);
              });
            }}
          />
          <TestButton
            label={t('testEmail')}
            disabled={pending || !emailConfigured}
            onClick={() => {
              startTransition(async () => {
                const result = await sendTestNotification({ spaceId, channel: 'email' });
                if (result.ok) toast.success(t('testEmailSent'));
                else toast.error(result.error.message);
              });
            }}
          />
        </div>
      </section>
    </div>
  );
}

function ChannelToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.checked);
      }}
    />
  );
}

function TestButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}
