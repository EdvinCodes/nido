import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('errors');
  const tCommon = await getTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t('notFoundTitle')}</h1>
      <p className="max-w-md text-balance text-muted-foreground">{t('notFoundDescription')}</p>
      <Button asChild>
        <Link href="/">{tCommon('goHome')}</Link>
      </Button>
    </main>
  );
}
