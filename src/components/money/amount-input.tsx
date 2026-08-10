'use client';

import { useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { normalizeAmountInput, parseMoney } from '@/lib/money/parse';
import { formatMoney } from '@/lib/money/format';
import { money } from '@/lib/money/money';
import { currencyExponent } from '@/lib/money/currencies';
import { cn } from '@/lib/utils';

export type AmountInputProps = {
  currency: string;
  locale?: string;
  valueMinor: number | null;
  onValueChange: (minor: number | null) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
};

/**
 * Locale-aware amount field that emits integer minor units.
 * On blur, evaluates a single `+` / `-` expression (e.g. `12,50+3` → `15,50`).
 */
export function AmountInput({
  currency,
  locale = 'es-ES',
  valueMinor,
  onValueChange,
  id,
  name,
  placeholder,
  disabled,
  autoFocus,
  className,
  'aria-label': ariaLabel,
}: AmountInputProps) {
  const [text, setText] = useState(() =>
    valueMinor == null
      ? ''
      : formatMoney(money(BigInt(valueMinor), currency), {
          locale,
          showCurrency: false,
        }),
  );

  function commit(raw: string): void {
    const evaluated = evaluateAmountExpression(raw, locale, currency);
    if (evaluated == null) {
      setText(raw);
      onValueChange(null);
      return;
    }
    setText(
      formatMoney(money(BigInt(evaluated), currency), {
        locale,
        showCurrency: false,
      }),
    );
    onValueChange(evaluated);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setText(event.target.value);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    commit(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      commit(text);
    }
  }

  return (
    <Input
      id={id}
      name={name}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      // Quick-add: focus the amount field as soon as the sheet opens.
      // eslint-disable-next-line jsx-a11y/no-autofocus -- primary field of the capture flow
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn('amount tabular text-lg font-medium', className)}
    />
  );
}

/**
 * Parses a plain amount or a single binary `+`/`-` expression into minor units.
 * Lives next to the input so the money module stays free of UI concerns; arithmetic
 * still goes through `parseMoney` (bigint), never float.
 */
export function evaluateAmountExpression(
  raw: string,
  locale: string,
  currency: string,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Find the last + or - that is an operator (not a leading sign).
  let opIndex = -1;
  let op: '+' | '-' | null = null;
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '+' || ch === '-') {
      opIndex = i;
      op = ch;
    }
  }

  if (opIndex > 0 && op) {
    const leftRaw = trimmed.slice(0, opIndex);
    const rightRaw = trimmed.slice(opIndex + 1);
    const left = parseMoney(leftRaw, { locale, currency });
    const right = parseMoney(rightRaw, { locale, currency });
    if (!left.ok || !right.ok) return null;
    const result =
      op === '+' ? left.value.minor + right.value.minor : left.value.minor - right.value.minor;
    if (result <= 0n) return null;
    if (result > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(result);
  }

  const parsed = parseMoney(trimmed, { locale, currency });
  if (!parsed.ok) {
    // Also accept a normalized decimal without locale separators after keypad entry.
    const normalized = normalizeAmountInput(trimmed, locale);
    const retry = parseMoney(normalized, { locale, currency });
    if (!retry.ok) return null;
    if (retry.value.minor <= 0n) return null;
    if (retry.value.minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(retry.value.minor);
  }
  if (parsed.value.minor <= 0n) return null;
  if (parsed.value.minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(parsed.value.minor);
}

/** Scale a whole major-unit integer to minor units for the currency. */
export function majorToMinor(major: number, currency: string): number {
  const exp = currencyExponent(currency);
  let scale = 1;
  for (let i = 0; i < exp; i++) scale *= 10;
  return major * scale;
}
