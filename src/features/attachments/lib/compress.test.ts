import { describe, expect, it } from 'vitest';
import { ATTACHMENT_MAX_BYTES, isAllowedAttachment } from './compress';
import { receiptObjectPath, thumbObjectPath } from './path';

describe('attachment helpers', () => {
  it('accepts allowed mime types under the size cap', () => {
    const file = new File([new Uint8Array(100)], 'r.webp', { type: 'image/webp' });
    expect(isAllowedAttachment(file)).toBe(true);
  });

  it('rejects oversized files', () => {
    const file = new File([new Uint8Array(ATTACHMENT_MAX_BYTES + 1)], 'big.webp', {
      type: 'image/webp',
    });
    expect(isAllowedAttachment(file)).toBe(false);
  });

  it('builds space-scoped receipt paths', () => {
    const path = receiptObjectPath(
      '11111111-1111-4111-8111-111111111111',
      'webp',
      new Date('2026-08-11T12:00:00Z'),
    );
    expect(path).toMatch(/^11111111-1111-4111-8111-111111111111\/2026\/08\/[0-9a-f-]{36}\.webp$/);
  });

  it('derives thumb paths beside the original', () => {
    expect(thumbObjectPath('space/2026/08/abc.webp')).toBe('space/2026/08/abc-thumb.webp');
  });
});
