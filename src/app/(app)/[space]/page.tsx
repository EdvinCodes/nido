import { getTranslations } from 'next-intl/server';

interface SpaceDashboardPageProps {
  params: Promise<{ space: string }>;
}

/** Placeholder dashboard for the authenticated app shell. Real content arrives in Phase 03. */
export default async function SpaceDashboardPage({ params }: SpaceDashboardPageProps) {
  const { space } = await params;
  const t = await getTranslations('shell');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur lg:px-8">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{space}</p>
        <h1 className="text-xl font-semibold tracking-tight">{t('pageTitle')}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {t('pageTitle')} — placeholder. Phase 03 adds the real dashboard.
      </div>
    </>
  );
}
