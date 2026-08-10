'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateNotificationPreference } from './actions';
import type { PreferenceRow } from './queries';

export function NotificationsSettings({
  spaceId,
  preferences,
}: {
  spaceId: string;
  preferences: PreferenceRow[];
}) {
  const t = useTranslations('notifications');
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('settingsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settingsBody')}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
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
                  <input
                    type="checkbox"
                    checked={pref.inApp}
                    disabled={pending}
                    onChange={(e) => {
                      const inApp = e.target.checked;
                      startTransition(async () => {
                        await updateNotificationPreference({
                          spaceId,
                          kind: pref.kind,
                          inApp,
                        });
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    aria-label={t('disabledUntilP10')}
                  />
                  <span className="ml-2 text-xs text-muted-foreground">{t('soon')}</span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    aria-label={t('disabledUntilP10')}
                  />
                  <span className="ml-2 text-xs text-muted-foreground">{t('soon')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
