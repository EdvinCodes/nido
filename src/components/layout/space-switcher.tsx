'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { getUserSpaces } from '@/features/spaces/queries';
import { route } from '@/lib/routes';

type SpaceList = Awaited<ReturnType<typeof getUserSpaces>>;

export function SpaceSwitcher({
  spaces,
  currentSpaceId,
}: {
  spaces: SpaceList;
  currentSpaceId: string;
}) {
  const t = useTranslations('shell');
  const current = spaces.find((s) => s.space.id === currentSpaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-full justify-start"
          aria-label={t('switchSpace')}
        >
          <span className="truncate">{current?.space.name ?? t('spacePlaceholder')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {spaces.map((entry) => (
          <DropdownMenuItem key={entry.space.id} asChild>
            <Link href={route(`/s/${entry.space.id}`)}>
              <span className="truncate">{entry.space.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{entry.space.kind}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={route('/onboarding?new=1')}>{t('createSpace')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
