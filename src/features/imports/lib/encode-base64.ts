/** Encode bytes to base64 in browser and Node. */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i] ?? 0;
    binary += String.fromCharCode(code);
  }
  return btoa(binary);
}
