/** Curated IANA zones for household finance — full list is overwhelming in a plain text field. */
export const COMMON_TIMEZONES = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Warsaw',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
] as const;

export type TimezoneOption = { value: string; label: string };

export function buildTimezoneOptions(locale: string, current?: string | null): TimezoneOption[] {
  const values = new Set<string>(COMMON_TIMEZONES);
  if (current) values.add(current);

  const browserTz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  if (browserTz) values.add(browserTz);

  return [...values]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: formatTimezoneLabel(value, locale),
    }));
}

function formatTimezoneLabel(timeZone: string, locale: string): string {
  const friendly = timeZone.replace(/_/g, ' ');
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
    return offset ? `${friendly} (${offset})` : friendly;
  } catch {
    return friendly;
  }
}
