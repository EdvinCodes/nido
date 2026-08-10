import type { Route } from 'next';

/**
 * Narrow dynamic app paths for Next.js typed routes.
 * Callers must pass app-local (or absolute OAuth) URLs only.
 */
export function route(path: string): Route {
  return path as Route;
}
