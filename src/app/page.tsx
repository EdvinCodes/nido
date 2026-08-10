import { useTranslations } from 'next-intl';

/**
 * Temporary root page. Replaced by the real marketing landing in Phase 11 and by the
 * `(marketing)` / `(app)` route groups introduced in Phase 00's application-shell task.
 */
export default function Home() {
  const t = useTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t('appName')}</h1>
      <p className="max-w-md text-balance text-muted-foreground">
        Finanzas del hogar, compartidas. En construcción.
      </p>
    </main>
  );
}
