export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

/** Locale cookie set once a visitor picks a language explicitly. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isSupportedLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
