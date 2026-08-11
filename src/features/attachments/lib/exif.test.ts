import { describe, expect, it } from 'vitest';
import { COMPRESS_OPTIONS } from './compress';
import { jpegHasGpsExif } from './exif';

/**
 * JPEG SOI + APP1-like segment containing GPSLatitude text for EXIF strip tests.
 */
const GPS_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x4c,
  0x61, 0x74, 0x69, 0x74, 0x75, 0x64, 0x65, 0x00, 0xff, 0xd9,
]);

describe('jpegHasGpsExif', () => {
  it('detects GPS IFD in a fixture JPEG', () => {
    expect(jpegHasGpsExif(GPS_JPEG)).toBe(true);
  });

  it('returns false for a bare SOI/EOI JPEG', () => {
    expect(jpegHasGpsExif(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toBe(false);
  });
});

describe('compressReceipt EXIF stripping', () => {
  it('is configured to strip EXIF metadata before upload', () => {
    expect(COMPRESS_OPTIONS.preserveExif).toBe(false);
  });
});
