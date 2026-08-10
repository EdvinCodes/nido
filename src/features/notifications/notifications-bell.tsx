'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { route } from '@/lib/routes';
import { markAllNotificationsRead, markNotificationRead } from './actions';
import type { NotificationRow } from './queries';

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function NotificationsBellInner({
  spaceId,
  initialItems,
  initialUnread,
}: {
  spaceId: string;
  initialItems: NotificationRow[];
  initialUnread: number;
}) {
  const t = useTranslations('notifications');
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`notifications:${spaceId}:${crypto.randomUUID()}`);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'nido',
        table: 'notifications',
        filter: `space_id=eq.${spaceId}`,
      },
      (payload) => {
        const row = payload.new as NotificationRow;
        setItems((prev) => [row, ...prev].slice(0, 40));
        setUnread((n) => n + 1);
        if (row.kind === 'budget_threshold' || row.kind === 'budget_exceeded') {
          toast(row.title, { description: row.body ?? undefined });
        }
      },
    );
    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationRow[]>();
    for (const item of items) {
      const key = dayKey(item.created_at);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('bellLabel', { count: unread })}
        >
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-danger" aria-hidden />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">{t('title')}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || unread === 0}
            onClick={() => {
              startTransition(async () => {
                await markAllNotificationsRead({ spaceId });
                setItems((prev) =>
                  prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
                );
                setUnread(0);
              });
            }}
          >
            {t('markAllRead')}
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            grouped.map(([day, rows]) => (
              <div key={day}>
                <p className="bg-muted/40 px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                  {day}
                </p>
                <ul>
                  {rows.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={route(n.link ?? `/s/${spaceId}/budgets`)}
                        className="block px-3 py-2 text-sm hover:bg-muted/40"
                        onClick={() => {
                          if (!n.read_at) {
                            startTransition(async () => {
                              await markNotificationRead({ spaceId, notificationId: n.id });
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.id === n.id
                                    ? { ...row, read_at: new Date().toISOString() }
                                    : row,
                                ),
                              );
                              setUnread((u) => Math.max(0, u - 1));
                            });
                          }
                          setOpen(false);
                        }}
                      >
                        <p className={n.read_at ? 'text-muted-foreground' : 'font-medium'}>
                          {n.title}
                        </p>
                        {n.body ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-2">
          <Link
            href={route(`/s/${spaceId}/settings/notifications`)}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setOpen(false);
            }}
          >
            {t('settingsLink')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationsBell({
  spaceId,
  initialItems,
  initialUnread,
}: {
  spaceId: string;
  initialItems: NotificationRow[];
  initialUnread: number;
}) {
  const syncKey = `${spaceId}:${initialUnread}:${initialItems[0]?.id ?? 'empty'}:${initialItems.length}`;
  return (
    <NotificationsBellInner
      key={syncKey}
      spaceId={spaceId}
      initialItems={initialItems}
      initialUnread={initialUnread}
    />
  );
}
