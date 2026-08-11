import type { StatementEncoding } from './types';

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function hasUtf16LeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
}

function hasUtf16BeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
}

function looksUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] ?? 0;
    if (b <= 0x7f) {
      i += 1;
      continue;
    }
    if (b >= 0xc2 && b <= 0xdf) {
      const b1 = bytes[i + 1] ?? 0;
      if (i + 1 >= bytes.length || (b1 & 0xc0) !== 0x80) return false;
      i += 2;
      continue;
    }
    if (b >= 0xe0 && b <= 0xef) {
      const b1 = bytes[i + 1] ?? 0;
      const b2 = bytes[i + 2] ?? 0;
      if (i + 2 >= bytes.length || (b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
        return false;
      }
      i += 3;
      continue;
    }
    return false;
  }
  return true;
}

export function decodeBytes(bytes: Uint8Array): { encoding: StatementEncoding; text: string } {
  if (hasUtf16LeBom(bytes)) {
    return { encoding: 'utf-16le', text: new TextDecoder('utf-16le').decode(bytes.slice(2)) };
  }
  if (hasUtf16BeBom(bytes)) {
    return { encoding: 'utf-16be', text: new TextDecoder('utf-16be').decode(bytes.slice(2)) };
  }
  if (hasUtf8Bom(bytes)) {
    return { encoding: 'utf-8', text: new TextDecoder('utf-8').decode(bytes.slice(3)) };
  }
  if (looksUtf8(bytes)) {
    return { encoding: 'utf-8', text: new TextDecoder('utf-8').decode(bytes) };
  }
  return { encoding: 'latin-1', text: new TextDecoder('latin-1').decode(bytes) };
}

export function detectEncodingFromText(text: string): StatementEncoding {
  if (text.charCodeAt(0) === 0xfeff) return 'utf-16le';
  return 'utf-8';
}
