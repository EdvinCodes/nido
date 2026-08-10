import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getProfile, getUserSpaces } from '@/features/spaces/queries';
import { createClient } from '@/lib/supabase/server';

/** Placeholder landing. Authenticated users are sent to their last space or onboarding. */
export default async function MarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await getProfile();
    if (profile?.last_active_space_id) {
      redirect(`/s/${profile.last_active_space_id}`);
    }
    const spaces = await getUserSpaces();
    const first = spaces[0]?.space.id;
    if (first) redirect(`/s/${first}`);
    redirect('/onboarding');
  }

  const t = await getTranslations('marketing');
  const tCommon = await getTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        {tCommon('appName')}
      </p>
      <h1 className="max-w-2xl font-display text-display-md text-balance">{t('headline')}</h1>
      <p className="max-w-lg text-lg text-balance text-muted-foreground">{t('subhead')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/sign-up">{t('ctaApp')}</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://github.com/EdvinCodes/nido" rel="noopener noreferrer">
            {t('ctaGithub')}
          </a>
        </Button>
      </div>
    </main>
  );
}
