import { getTranslations } from 'next-intl/server';

interface SectionPageProps {
  params: Promise<{ space: string; section: string }>;
}

/** Placeholder for secondary app routes linked from the static shell navigation. */
export default async function SpaceSectionPage({ params }: SectionPageProps) {
  const { space, section } = await params;
  const t = await getTranslations('shell');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur lg:px-8">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{space}</p>
        <h1 className="text-xl font-semibold tracking-tight capitalize">
          {section.replace(/-/g, ' ')}
        </h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {t('pageTitle')} / {section} — placeholder shell route.
      </div>
    </>
  );
}
