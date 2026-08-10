import { describe, expect, it } from 'vitest';
import { allocateByNumbers } from './allocate';
import { ALLOCATE_FIXTURES } from './allocate.fixtures';

describe('allocate — SQL parity fixtures', () => {
  it.each(ALLOCATE_FIXTURES)(
    'allocate($total, $weights) === $expected',
    ({ total, weights, expected }) => {
      expect(allocateByNumbers(total, weights)).toEqual(expected);
    },
  );
});
