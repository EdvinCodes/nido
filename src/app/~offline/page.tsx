import { getTranslations } from 'next-intl/server';

export default async function OfflinePage() {
  const t = await getTranslations('pwa');

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="font-display text-2xl font-normal tracking-tight">{t('offlineTitle')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('offlineBody')}</p>
    </main>
  );
}
