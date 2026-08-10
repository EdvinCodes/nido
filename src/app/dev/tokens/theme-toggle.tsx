'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

function subscribeToClientMount(onStoreChange: () => void): () => void {
  onStoreChange();
  return () => undefined;
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Local toggle for the token review page only. The product's real theme switch lives in
 * settings once profiles exist (Phase 01); this one exists purely so both themes can be
 * inspected on `/dev/tokens` without touching the OS setting.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientSnapshot,
    getServerSnapshot,
  );

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      }}
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === 'dark' ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      {mounted ? resolvedTheme : '…'}
    </Button>
  );
}
