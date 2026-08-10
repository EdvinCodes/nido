import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { route } from '@/lib/routes';

export default async function SpaceDashboardPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const t = await getTranslations('shell');
  const tNav = await getTranslations('nav');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">{t('pageTitle')}</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="font-display text-2xl">{t('emptyTitle')}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={route(`/s/${spaceId}/settings/members`)}>{tNav('members')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={route(`/s/${spaceId}/settings/categories`)}>{tNav('categories')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={route(`/s/${spaceId}/settings/accounts`)}>{tNav('accounts')}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={route(`/s/${spaceId}/settings/profile`)}>{tNav('profile')}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
