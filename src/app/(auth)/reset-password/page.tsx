'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPasswordAction } from '@/features/auth/actions';
import { resetPasswordSchema } from '@/features/auth/schemas';

type Values = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '' },
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('resetTitle')}</h1>
      </div>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          startTransition(async () => {
            const result = await resetPasswordAction(values);
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            router.push('/');
            router.refresh();
          });
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="password">{tCommon('password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('updatePassword')}
        </Button>
      </form>
    </div>
  );
}
