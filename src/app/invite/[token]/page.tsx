import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AcceptInviteClient } from '@/features/spaces/accept-invite-client';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations('invite');
  const tAuth = await getTranslations('auth');
  const tCommon = await getTranslations('common');

  if (!user) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6 py-16 text-center">
        <p>{t('signInPrompt')}</p>
        <Button asChild>
          <Link href={route(`/sign-up?next=${encodeURIComponent(`/invite/${token}`)}`)}>
            {tAuth('signUp')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={route(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`)}>
            {tAuth('signIn')}
          </Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6 py-16 text-center">
      <AcceptInviteClient token={token} />
      <Button variant="ghost" asChild>
        <Link href="/">{tCommon('goHome')}</Link>
      </Button>
    </main>
  );
}
