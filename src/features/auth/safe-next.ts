/** Only ever redirect to a same-origin path, never an attacker-supplied absolute URL. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}
