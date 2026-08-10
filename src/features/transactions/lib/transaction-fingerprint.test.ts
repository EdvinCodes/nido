import { describe, expect, it } from 'vitest';
import {
  transactionFingerprint,
  type TransactionFingerprintInput,
} from './transaction-fingerprint';

const base: TransactionFingerprintInput = {
  spaceId: 'space-1',
  bookedOn: '2026-08-10',
  amountMinor: 1234n,
  currency: 'EUR',
  accountId: 'account-1',
  merchant: 'Mercadona',
  description: 'Weekly groceries',
};

describe('transactionFingerprint', () => {
  it('is deterministic for identical input', () => {
    expect(transactionFingerprint(base)).toBe(transactionFingerprint({ ...base }));
  });

  it('returns a fixed-width lowercase hex string', () => {
    const hash = transactionFingerprint(base);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable regardless of merchant casing and surrounding whitespace', () => {
    const upper = transactionFingerprint({ ...base, merchant: '  MERCADONA  ' });
    expect(upper).toBe(transactionFingerprint(base));
  });

  it('collapses internal whitespace when normalizing text', () => {
    const spaced = transactionFingerprint({ ...base, merchant: 'Mercadona   Sabadell' });
    const collapsed = transactionFingerprint({ ...base, merchant: 'Mercadona Sabadell' });
    expect(spaced).toBe(collapsed);
  });

  it('falls back to description when merchant is absent', () => {
    const withMerchant = transactionFingerprint({
      spaceId: 'space-1',
      bookedOn: '2026-08-10',
      amountMinor: 1234n,
      currency: 'EUR',
      accountId: 'account-1',
      description: 'Weekly groceries',
    });
    const withDescriptionOnly = transactionFingerprint({
      ...base,
      merchant: null,
      description: 'Weekly groceries',
    });
    expect(withMerchant).toBe(withDescriptionOnly);
  });

  it('changes when the space differs', () => {
    expect(transactionFingerprint({ ...base, spaceId: 'space-2' })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('changes when the booked date differs', () => {
    expect(transactionFingerprint({ ...base, bookedOn: '2026-08-11' })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('changes when the amount differs', () => {
    expect(transactionFingerprint({ ...base, amountMinor: 1235n })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('changes when the currency differs', () => {
    expect(transactionFingerprint({ ...base, currency: 'USD' })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('changes when the account differs', () => {
    expect(transactionFingerprint({ ...base, accountId: 'account-2' })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('treats a null account as distinct from any real account', () => {
    expect(transactionFingerprint({ ...base, accountId: null })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('changes when the normalized text differs', () => {
    expect(transactionFingerprint({ ...base, merchant: 'Carrefour' })).not.toBe(
      transactionFingerprint(base),
    );
  });

  it('does not conflate fields that would collide under naive concatenation', () => {
    // "ab" + "c" === "a" + "bc" without a field separator; the fingerprint must still differ.
    const a = transactionFingerprint({ ...base, spaceId: 'ab', bookedOn: 'c' });
    const b = transactionFingerprint({ ...base, spaceId: 'a', bookedOn: 'bc' });
    expect(a).not.toBe(b);
  });
});
