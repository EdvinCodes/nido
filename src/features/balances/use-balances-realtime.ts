'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const SETTLEMENT_NOTIFICATION_KINDS = new Set(['settlement_request', 'settlement_confirmed']);

/** Invoke `onChange` when settlements change (propose / confirm / reverse). */
export function useBalancesRealtime(
  spaceId: string,
  userId: string,
  onChange: () => void | Promise<void>,
): void {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`balances:${spaceId}:${crypto.randomUUID()}`);

    const notify = () => {
      void onChange();
    };

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'nido',
        table: 'settlements',
        filter: `space_id=eq.${spaceId}`,
      },
      notify,
    );

    // Backup path: confirm/dispute RPCs also insert in-app notifications.
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'nido',
        table: 'notifications',
        filter: `space_id=eq.${spaceId}`,
      },
      (payload) => {
        const row = payload.new as { user_id?: string; kind?: string };
        if (row.user_id === userId && row.kind && SETTLEMENT_NOTIFICATION_KINDS.has(row.kind)) {
          notify();
        }
      },
    );

    channel.subscribe((status) => {
      // Supabase passes a RealtimeSubscribeStatus enum; compare to the subscribed literal.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- status is RealtimeSubscribeStatus
      if (status === 'SUBSCRIBED') {
        notify();
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId, userId, onChange]);
}
