'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { TimezoneSelect } from '@/components/forms/timezone-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateProfileAction, uploadAvatarAction } from '@/features/spaces/actions';
import { LOCALE_COOKIE } from '@/i18n/locales';

type Profile = {
  display_name: string;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  theme: string;
  colourblind_safe: boolean;
};

export function ProfileForm({ profile, userId: _userId }: { profile: Profile; userId: string }) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [locale, setLocale] = useState(profile.locale);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [themeValue, setThemeValue] = useState(profile.theme);
  const [colourblind, setColourblind] = useState(profile.colourblind_safe);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="mx-auto max-w-lg space-y-6 p-4 lg:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateProfileAction({
            displayName,
            locale: locale as 'es' | 'en',
            timezone,
            theme: themeValue as 'light' | 'dark' | 'system',
            colourblindSafe: colourblind,
          });
          if (result.ok) {
            document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000`;
            setTheme(themeValue);
            document.documentElement.classList.toggle('colourblind', colourblind);
            setMessage(t('saved'));
            router.refresh();
          }
        });
      }}
    >
      <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>

      <div className="space-y-2">
        <Label htmlFor="displayName">{t('displayName')}</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar">{t('avatar')}</Label>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={avatarUrl} alt="" className="size-16 rounded-full object-cover" />
        ) : null}
        <Input
          id="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.set('file', file);
            startTransition(async () => {
              const result = await uploadAvatarAction(formData);
              if (result.ok) setAvatarUrl(result.data.url);
            });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('locale')}</Label>
        <Select value={locale} onValueChange={setLocale}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">{t('timezone')}</Label>
        <TimezoneSelect
          id="timezone"
          value={timezone}
          onValueChange={(value) => {
            setTimezone(value);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('theme')}</Label>
        <Select
          value={themeValue}
          onValueChange={(v) => {
            setThemeValue(v);
            setTheme(v);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">{t('themeLight')}</SelectItem>
            <SelectItem value="dark">{t('themeDark')}</SelectItem>
            <SelectItem value="system">{t('themeSystem')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium" id="colourblind-label">
          {t('colourblind')}
        </p>
        <label className="flex items-start gap-3 text-sm" htmlFor="colourblind">
          <input
            id="colourblind"
            type="checkbox"
            className="mt-1"
            checked={colourblind}
            aria-describedby="colourblind-hint"
            onChange={(e) => {
              setColourblind(e.target.checked);
            }}
          />
          <span id="colourblind-hint" className="text-muted-foreground">
            {t('colourblindHint')}
          </span>
        </label>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Button type="submit" disabled={pending}>
        {tCommon('save')}
      </Button>

      <div className="border-t border-border pt-6">
        <p className="text-sm font-medium">{t('session')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('sessionHint')}</p>
        <SignOutButton variant="outline" className="mt-3" />
      </div>
    </form>
  );
}
