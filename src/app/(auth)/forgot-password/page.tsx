'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordAction } from '@/features/auth/actions';
import { forgotPasswordSchema } from '@/features/auth/schemas';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('forgotTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgotSubtitle')}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            await forgotPasswordAction(values);
            setSent(true);
          });
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="email">{tCommon('email')}</Label>
          <Input id="email" type="email" {...form.register('email')} />
        </div>
        {sent ? <p className="text-sm text-muted-foreground">{t('resetSent')}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('sendReset')}
        </Button>
      </form>
      <Link href="/sign-in" className="text-sm text-primary hover:underline">
        {t('signIn')}
      </Link>
    </div>
  );
}
