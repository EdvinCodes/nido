'use client';

import { useEffect, useEffectEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Invoke `onChange` when settlements change (propose / confirm / reverse). */
export function useBalancesRealtime(spaceId: string, onChange: () => void): void {
  const handleChange = useEffectEvent(onChange);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`settlements:${spaceId}:${crypto.randomUUID()}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'nido',
        table: 'settlements',
        filter: `space_id=eq.${spaceId}`,
      },
      () => {
        handleChange();
      },
    );
    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId]);
}
