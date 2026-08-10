'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const HIGHLIGHT_MS = 1200;

/**
 * Subscribes to `nido.transactions` for the space and refreshes ledger queries.
 * Returns ids that should briefly show the design-system accent highlight.
 */
export function useLedgerRealtime(spaceId: string): Set<string> {
  const queryClient = useQueryClient();
  const [highlightedIds, setHighlightedIds] = useState(() => new Set<string>());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ledger:${spaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'nido',
          table: 'transactions',
          filter: `space_id=eq.${spaceId}`,
        },
        (payload) => {
          const row =
            payload.eventType === 'DELETE'
              ? (payload.old as { id?: string })
              : (payload.new as { id?: string });
          const id = row.id;
          if (id) {
            setHighlightedIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            });
            window.setTimeout(() => {
              setHighlightedIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, HIGHLIGHT_MS);
          }
          void queryClient.invalidateQueries({ queryKey: ['transactions', spaceId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId, queryClient]);

  return highlightedIds;
}
