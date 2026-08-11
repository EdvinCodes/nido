'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/features/auth/actions';
import { cn } from '@/lib/utils';

export function SignOutButton({
  variant = 'ghost',
  size = 'default',
  showIcon = true,
  className,
}: {
  variant?: 'ghost' | 'outline' | 'secondary';
  size?: 'default' | 'sm';
  showIcon?: boolean;
  className?: string;
}) {
  const t = useTranslations('auth');
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('justify-start gap-2', className)}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await signOutAction();
        });
      }}
    >
      {showIcon ? <LogOut className="size-4 shrink-0" aria-hidden /> : null}
      {t('signOut')}
    </Button>
  );
}
