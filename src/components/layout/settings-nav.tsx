'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { cn } from '@/lib/utils';
import { route } from '@/lib/routes';

const ITEMS = [
  { href: '/settings/ai', labelKey: 'ai' as const },
  { href: '/settings/profile', labelKey: 'profile' as const },
  { href: '/settings/members', labelKey: 'members' as const },
  { href: '/settings/space', labelKey: 'spaceSettings' as const },
  { href: '/settings/accounts', labelKey: 'accounts' as const },
  { href: '/settings/categories', labelKey: 'categories' as const },
  { href: '/settings/rules', labelKey: 'rules' as const },
  { href: '/settings/notifications', labelKey: 'notifications' as const },
  { href: '/settings/storage', labelKey: 'storage' as const },
  { href: '/settings/banking', labelKey: 'banking' as const },
] as const;

export function SettingsNav({ spaceId }: { spaceId: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const base = `/s/${spaceId}`;

  return (
    <nav
      aria-label={t('settings')}
      className="shrink-0 border-b border-border lg:w-52 lg:border-r lg:border-b-0"
    >
      <ul className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible lg:p-3">
        {ITEMS.map(({ href, labelKey }) => {
          const fullHref = `${base}${href}`;
          const active = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
          return (
            <li key={href} className="shrink-0 lg:shrink">
              <Link
                href={route(fullHref)}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-surface-raised font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-surface-raised/70 hover:text-foreground',
                )}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border p-3 lg:hidden">
        <SignOutButton variant="outline" size="sm" className="w-full" />
      </div>
      <div className="hidden border-t border-border p-3 lg:block">
        <SignOutButton variant="ghost" size="sm" className="w-full" />
      </div>
    </nav>
  );
}
