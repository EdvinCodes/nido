import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  abs,
  add,
  compare,
  equals,
  fromDecimalString,
  isNegative,
  isZero,
  money,
  MoneyError,
  multiply,
  negate,
  ratio,
  subtract,
  sum,
  toDecimalString,
  zero,
} from './money';

describe('money', () => {
  it('constructs from minor units', () => {
    expect(money(1234n, 'EUR')).toEqual({ minor: 1234n, currency: 'EUR' });
    expect(money(1234, 'EUR').minor).toBe(1234n);
  });

  it('rejects a non-integer number of minor units', () => {
    expect(() => money(12.5, 'EUR')).toThrow(MoneyError);
  });

  it('adds and subtracts', () => {
    const a = money(1050n, 'EUR');
    const b = money(275n, 'EUR');
    expect(add(a, b).minor).toBe(1325n);
    expect(subtract(a, b).minor).toBe(775n);
  });

  it('refuses to mix currencies', () => {
    expect(() => add(money(100n, 'EUR'), money(100n, 'USD'))).toThrow(MoneyError);
    expect(() => compare(money(100n, 'EUR'), money(100n, 'USD'))).toThrow(MoneyError);
  });

  it('sums a list', () => {
    expect(sum([money(100n), money(250n), money(-50n)]).minor).toBe(300n);
    expect(sum([], 'USD')).toEqual(zero('USD'));
  });

  it('negates and takes absolute values', () => {
    expect(negate(money(-500n)).minor).toBe(500n);
    expect(abs(money(-500n)).minor).toBe(500n);
    expect(abs(money(500n)).minor).toBe(500n);
  });

  it('multiplies by a rational, rounding half away from zero', () => {
    expect(multiply(money(1000n), 1n, 3n).minor).toBe(333n);
    expect(multiply(money(1000n), 2n, 3n).minor).toBe(667n);
    expect(multiply(money(100n), 1n, 8n).minor).toBe(13n); // 12.5 rounds up
    expect(multiply(money(-100n), 1n, 8n).minor).toBe(-13n);
    expect(multiply(money(1050n), 3n).minor).toBe(3150n);
  });

  it('rejects division by zero', () => {
    expect(() => multiply(money(100n), 1n, 0n)).toThrow(MoneyError);
  });

  it('compares and tests', () => {
    expect(compare(money(100n), money(200n))).toBe(-1);
    expect(compare(money(200n), money(100n))).toBe(1);
    expect(compare(money(100n), money(100n))).toBe(0);
    expect(equals(money(100n, 'EUR'), money(100n, 'USD'))).toBe(false);
    expect(isZero(zero())).toBe(true);
    expect(isNegative(money(-1n))).toBe(true);
  });

  it('computes a ratio, guarding against division by zero', () => {
    expect(ratio(money(500n), money(1000n))).toBe(0.5);
    expect(ratio(money(500n), zero())).toBe(0);
  });
});

describe('decimal strings', () => {
  it('renders two-decimal currencies', () => {
    expect(toDecimalString(money(123_456n, 'EUR'))).toBe('1234.56');
    expect(toDecimalString(money(5n, 'EUR'))).toBe('0.05');
    expect(toDecimalString(money(0n, 'EUR'))).toBe('0.00');
    expect(toDecimalString(money(-5n, 'EUR'))).toBe('-0.05');
  });

  it('renders zero-decimal currencies', () => {
    expect(toDecimalString(money(1234n, 'JPY'))).toBe('1234');
    expect(toDecimalString(money(-1234n, 'JPY'))).toBe('-1234');
  });

  it('renders three-decimal currencies', () => {
    expect(toDecimalString(money(1234n, 'TND'))).toBe('1.234');
  });

  it('parses decimal strings', () => {
    expect(fromDecimalString('1234.56', 'EUR').minor).toBe(123_456n);
    expect(fromDecimalString('12.5', 'EUR').minor).toBe(1250n);
    expect(fromDecimalString('12', 'EUR').minor).toBe(1200n);
    expect(fromDecimalString('-0.05', 'EUR').minor).toBe(-5n);
    expect(fromDecimalString('1234', 'JPY').minor).toBe(1234n);
  });

  it('rejects more decimals than the currency supports', () => {
    expect(() => fromDecimalString('12.345', 'EUR')).toThrow(MoneyError);
    expect(() => fromDecimalString('12.5', 'JPY')).toThrow(MoneyError);
  });

  it('rejects nonsense', () => {
    expect(() => fromDecimalString('abc', 'EUR')).toThrow(MoneyError);
    expect(() => fromDecimalString('', 'EUR')).toThrow(MoneyError);
    expect(() => fromDecimalString('1,5', 'EUR')).toThrow(MoneyError);
  });

  it('round-trips any amount', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -1_000_000_000_000n, max: 1_000_000_000_000n }),
        fc.constantFrom('EUR', 'JPY', 'TND'),
        (minor, currency) => {
          const value = money(minor, currency);
          return fromDecimalString(toDecimalString(value), currency).minor === minor;
        },
      ),
      { numRuns: 1000 },
    );
  });
});
