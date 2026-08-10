import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/marketing/landing-page';
import { getProfile, getUserSpaces } from '@/features/spaces/queries';
import { createClient } from '@/lib/supabase/server';

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

  return <LandingPage />;
}
