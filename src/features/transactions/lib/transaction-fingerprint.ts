/**
 * Deduplication hash for transactions, reused by Phase 08 import/bank-sync to match
 * `import_rows.fingerprint` against existing ledger rows (see docs/02-DATA-MODEL.md
 * `import_rows` and docs/04-FEATURES.md § "Preview").
 *
 * Fields hashed, in order:
 * 1. `spaceId` — fingerprints must never collide across spaces.
 * 2. `bookedOn` — the accounting day, as an ISO `date` string (`YYYY-MM-DD`).
 * 3. `amountMinor` — exact minor units, never a float.
 * 4. `currency` — the transaction's own currency code.
 * 5. `accountId` — the account it was booked against, or `null` for unassigned entries.
 * 6. The normalized (trimmed, lower-cased, whitespace-collapsed) merchant, falling back to
 *    the description when there is no merchant, so a bank-provided merchant string and a
 *    manually typed description for the same real-world purchase still line up.
 *
 * A real cryptographic hash (SHA-256) is unnecessary here and the Web Crypto implementation
 * is async, which would force every caller (including synchronous pure-function call sites)
 * to become async. A 64-bit FNV-1a hash is deterministic, collision-resistant enough for
 * "candidate duplicate" matching (which is always confirmed by comparing the real fields,
 * see `nido.find_duplicate`), and fully synchronous.
 */

export type TransactionFingerprintInput = {
  spaceId: string;
  /** ISO `date` string, e.g. "2026-08-10". */
  bookedOn: string;
  amountMinor: bigint;
  currency: string;
  accountId: string | null;
  merchant?: string | null;
  description?: string | null;
};

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const FIELD_SEPARATOR = '\u001f';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Deterministic, synchronous 64-bit FNV-1a hash, rendered as a fixed-width hex string. */
function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS_64;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

export function transactionFingerprint(input: TransactionFingerprintInput): string {
  const normalizedText = normalizeText(input.merchant) || normalizeText(input.description);

  const normalized = [
    input.spaceId,
    input.bookedOn,
    input.amountMinor.toString(),
    input.currency,
    input.accountId ?? '',
    normalizedText,
  ].join(FIELD_SEPARATOR);

  return fnv1a64(normalized);
}
