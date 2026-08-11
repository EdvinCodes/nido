import { describe, expect, it } from 'vitest';
import { parseCitationLinks, splitCitationText } from '@/features/assistant/lib/citations';

describe('parseCitationLinks', () => {
  it('extracts ledger links with transaction ids', () => {
    const text =
      'You spent [€412.00](nido:ledger?ids=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222) on food.';
    const links = parseCitationLinks(text, 'space-id');
    expect(links).toHaveLength(1);
    expect(links[0]?.label).toBe('€412.00');
    expect(links[0]?.href).toContain('ids=11111111-1111-4111-8111-111111111111');
  });
});

describe('splitCitationText', () => {
  it('splits plain text and citation chips', () => {
    const parts = splitCitationText(
      'Total [€10.00](nido:ledger?ids=11111111-1111-4111-8111-111111111111) today.',
      'space-id',
    );
    expect(parts).toEqual([
      { kind: 'text', value: 'Total ' },
      {
        kind: 'cite',
        label: '€10.00',
        href: '/s/space-id/ledger?ids=11111111-1111-4111-8111-111111111111',
      },
      { kind: 'text', value: ' today.' },
    ]);
  });
});
