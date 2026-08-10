#!/usr/bin/env node
/**
 * Generates a VAPID key pair for Web Push (Phase 10). VAPID keys are a plain P-256
 * (prime256v1) elliptic-curve key pair: the public key is the uncompressed point
 * (0x04 || X || Y, 65 bytes), the private key is the raw scalar (32 bytes), both
 * base64url-encoded without padding. No dependency on the `web-push` package is needed
 * for this — Node's built-in `crypto` module covers it. See docs/01-ARCHITECTURE.md §9.
 */

import { createECDH } from 'node:crypto';

const PRIVATE_KEY_LENGTH = 32;

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();

const publicKey = ecdh.getPublicKey();
const rawPrivateKey = ecdh.getPrivateKey();

// `getPrivateKey()` omits leading zero bytes, so the scalar must be re-padded to a fixed
// 32 bytes — otherwise a private key that happens to start with 0x00 silently corrupts.
const privateKey = Buffer.concat([
  Buffer.alloc(PRIVATE_KEY_LENGTH - rawPrivateKey.length),
  rawPrivateKey,
]);

process.stdout.write(
  [
    'VAPID keys generated. Add these to .env.local (never commit real values):',
    '',
    `VAPID_PUBLIC_KEY=${publicKey.toString('base64url')}`,
    `VAPID_PRIVATE_KEY=${privateKey.toString('base64url')}`,
    'VAPID_SUBJECT=mailto:you@example.com',
    '',
  ].join('\n'),
);
