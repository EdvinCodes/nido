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
import {
  signInAction,
  signInWithGoogleAction,
  signInWithMagicLinkAction,
} from '@/features/auth/actions';
import { signInSchema, type SignInInput } from '@/features/auth/schemas';
import { DevSignInPanel } from '@/features/auth/dev-sign-in-panel';
import { route } from '@/lib/routes';

export function SignInForm() {
  const t = useTranslations('auth');
  const tErr = useTranslations('auth.errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? undefined;
  const [errorCode, setErrorCode] = useState<string | null>(
    searchParams.get('error') === 'oauth' ? 'oauth' : null,
  );
  const [magicSent, setMagicSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', next },
  });

  const errorMessage = useMemo(() => {
    if (!errorCode) return null;
    try {
      return tErr(errorCode as 'invalid_credentials');
    } catch {
      return tErr('auth_error');
    }
  }, [errorCode, tErr]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('signInTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('signInSubtitle')}</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setErrorCode(null);
          startTransition(async () => {
            const result = await signInAction({ ...values, next });
            if (!result.ok) {
              setErrorCode(result.error.code);
              return;
            }
            router.push(route(result.data.next));
            router.refresh();
          });
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="email">{t('signIn') === 'Sign in' ? 'Email' : 'Correo'}</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              {t('signIn') === 'Sign in' ? 'Password' : 'Contraseña'}
            </Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
          />
        </div>
        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('signIn')}
        </Button>
      </form>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setErrorCode(null);
            startTransition(async () => {
              const email = form.getValues('email');
              const result = await signInWithMagicLinkAction({ email, next });
              if (!result.ok) {
                setErrorCode(result.error.code);
                return;
              }
              setMagicSent(true);
            });
          }}
        >
          {t('magicLink')}
        </Button>
        {magicSent ? <p className="text-sm text-muted-foreground">{t('magicLinkSent')}</p> : null}
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
      </div>

      <DevSignInPanel {...(next ? { next } : {})} />

      <p className="text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link
          href={route(`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ''}`)}
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
