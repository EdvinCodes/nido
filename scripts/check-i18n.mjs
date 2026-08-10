#!/usr/bin/env node
/**
 * Ensures en.json and es.json expose the same key paths. Run in CI via `pnpm check:i18n`.
 */

import en from '../src/i18n/messages/en.json' with { type: 'json' };
import es from '../src/i18n/messages/es.json' with { type: 'json' };

function leafKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...leafKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

const enKeys = leafKeys(en);
const esKeys = leafKeys(es);
const missingInEs = enKeys.filter((k) => !esKeys.includes(k));
const missingInEn = esKeys.filter((k) => !enKeys.includes(k));

if (missingInEs.length > 0 || missingInEn.length > 0) {
  if (missingInEs.length > 0) {
    console.error('Keys missing in es.json:', missingInEs.join(', '));
  }
  if (missingInEn.length > 0) {
    console.error('Keys missing in en.json:', missingInEn.join(', '));
  }
  process.exit(1);
}

console.log(`i18n OK — ${enKeys.length} keys in en/es.`);
