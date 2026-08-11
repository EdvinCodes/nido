import { describe, expect, it, vi } from 'vitest';
import { hapticSuccess, hapticTap } from '@/lib/haptics';

describe('haptics', () => {
  it('calls navigator.vibrate when available', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    hapticTap(10);
    expect(vibrate).toHaveBeenCalledWith(10);

    hapticSuccess();
    expect(vibrate).toHaveBeenCalledWith([10, 40, 10]);

    vi.unstubAllGlobals();
  });

  it('no-ops when vibrate is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(() => {
      hapticTap();
    }).not.toThrow();
    vi.unstubAllGlobals();
  });
});
