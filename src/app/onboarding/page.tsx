import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { OnboardingWizard } from '@/features/spaces/onboarding-wizard';
import { getUserSpaces } from '@/features/spaces/queries';
import { route } from '@/lib/routes';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const spaces = await getUserSpaces();
  const first = spaces[0];
  if (first && params.new !== '1') {
    redirect(route(`/s/${first.space.id}`));
  }

  return (
    <main>
      <Suspense>
        <OnboardingWizard />
      </Suspense>
    </main>
  );
}
