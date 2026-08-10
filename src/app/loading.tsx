import { getTranslations } from 'next-intl/server';
import { Skeleton } from '@/components/ui/skeleton';

export default async function RootLoading() {
  const t = await getTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </main>
  );
}
