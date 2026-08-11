import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { OnboardingWizard } from '@/features/spaces/onboarding-wizard';
import { getProfile, getUserSpaces } from '@/features/spaces/queries';
import { route } from '@/lib/routes';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const [spaces, profile] = await Promise.all([getUserSpaces(), getProfile()]);
  const first = spaces[0];
  if (first && params.new !== '1') {
    redirect(route(`/s/${first.space.id}`));
  }

  const cancelHref =
    params.new === '1' && first
      ? route(`/s/${profile?.last_active_space_id ?? first.space.id}`)
      : null;

  return (
    <main>
      <Suspense>
        <OnboardingWizard cancelHref={cancelHref} />
      </Suspense>
    </main>
  );
}
