/** Strip terminal noise, refs, embedded dates, collapse whitespace, title-case. */
export function normalizeMerchant(raw: string): string {
  let s = raw.trim();

  // Remove common card-terminal prefixes/suffixes.
  s = s.replace(/^(visa|mastercard|mc|maestro|tpv|pos)\s*[-*]?\s*/i, '');
  s = s.replace(/\s*(visa|mastercard|mc)\s*$/i, '');

  // Reference / auth codes (6+ digits or alphanumeric blocks).
  s = s.replace(/\b(ref|referencia|auth|aut)\.?\s*[a-z0-9]{4,}\b/gi, '');
  s = s.replace(/\b\d{6,}\b/g, '');

  // Embedded dates DD/MM/YY, DD-MM-YYYY, etc.
  s = s.replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, '');

  // Repeated whitespace and punctuation runs.
  s = s
    .replace(/[\s*]+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' ')
    .trim();

  if (!s) return '';

  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 3 && /^[a-z]+$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
