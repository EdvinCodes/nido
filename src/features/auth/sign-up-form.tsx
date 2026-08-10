'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithGoogleAction, signUpAction } from '@/features/auth/actions';
import { signUpSchema, type SignUpInput } from '@/features/auth/schemas';
import { route } from '@/lib/routes';

function strengthScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export function SignUpForm() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErr = useTranslations('auth.errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? undefined;
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [password, setPassword] = useState('');
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', displayName: '', next },
  });

  const score = strengthScore(password);
  const strengthLabel =
    score <= 1
      ? t('strengthWeak')
      : score === 2
        ? t('strengthFair')
        : score === 3
          ? t('strengthGood')
          : t('strengthStrong');

  const errorMessage = useMemo(() => {
    if (!errorCode) return null;
    try {
      return tErr(errorCode as 'email_exists');
    } catch {
      return tErr('auth_error');
    }
  }, [errorCode, tErr]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('signUpTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('signUpSubtitle')}</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setErrorCode(null);
          startTransition(async () => {
            const result = await signUpAction({ ...values, next });
            if (!result.ok) {
              setErrorCode(result.error.code);
              return;
            }
            router.push(route(result.data.next === '/' ? '/onboarding' : result.data.next));
            router.refresh();
          });
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="displayName">{t('displayName')}</Label>
          <Input id="displayName" autoComplete="name" {...form.register('displayName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{tCommon('email')}</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{tCommon('password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              const value = e.target.value;
              setPassword(value);
              form.setValue('password', value, { shouldValidate: true });
            }}
          />
          <div className="space-y-1" aria-live="polite">
            <p className="text-xs text-muted-foreground">
              {t('passwordStrength')}: {strengthLabel}
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i <= score ? 'bg-primary' : 'bg-muted'}`}
                />
              ))}
            </div>
          </div>
        </div>
        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('signUp')}
        </Button>
      </form>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await signInWithGoogleAction(next);
          });
        }}
      >
        {t('google')}
      </Button>

      <p className="text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link
          href={route(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`)}
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
