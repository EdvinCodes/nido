'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { acceptInviteAction } from '@/features/spaces/actions';
import { route } from '@/lib/routes';

export function AcceptInviteClient({ token }: { token: string }) {
  const t = useTranslations('invite');
  const router = useRouter();
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await acceptInviteAction({ token });
      if (!result.ok) {
        setError(true);
        return;
      }
      router.replace(route(`/s/${result.data.spaceId}`));
      router.refresh();
    });
  }, [token, router]);

  if (error) {
    return <p>{t('invalid')}</p>;
  }

  return <p>{t('accepting')}</p>;
}
