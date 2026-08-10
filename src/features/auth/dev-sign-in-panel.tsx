'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signInAction } from '@/features/auth/actions';
import { DEV_DEMO_USER, DEV_DEMO_USER_ALT } from '@/features/auth/dev-credentials';
import { route } from '@/lib/routes';

export function DevSignInPanel({ next }: { next?: string }) {
  const t = useTranslations('auth.dev');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  function signInAs(email: string, password: string): void {
    startTransition(async () => {
      const result = await signInAction({ email, password, next });
      if (!result.ok) {
        toast.error(t('loginFailed'));
        return;
      }
      router.push(route(result.data.next));
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">{t('badge')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={pending}
          onClick={() => {
            signInAs(DEV_DEMO_USER.email, DEV_DEMO_USER.password);
          }}
        >
          {t('loginAs', { name: DEV_DEMO_USER.label })}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => {
            signInAs(DEV_DEMO_USER_ALT.email, DEV_DEMO_USER_ALT.password);
          }}
        >
          {t('loginAs', { name: DEV_DEMO_USER_ALT.label })}
        </Button>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {DEV_DEMO_USER.email} · {t('passwordHint')}
      </p>
    </div>
  );
}
