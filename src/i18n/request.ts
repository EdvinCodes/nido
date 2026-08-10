import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import en from './messages/en.json';
import es from './messages/es.json';
import { defaultLocale, isSupportedLocale, LOCALE_COOKIE, type Locale } from './locales';

const messageCatalog: Record<Locale, typeof es> = { es, en };

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) return cookieLocale;

  const headerList = await headers();
  const acceptLanguage = headerList.get('accept-language');
  const preferred = acceptLanguage?.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
  if (preferred && isSupportedLocale(preferred)) return preferred;

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return { locale, messages: messageCatalog[locale] };
});
