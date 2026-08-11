/** Detect GPS-related EXIF tags in a JPEG byte stream (client-side sanity check). */
export function jpegHasGpsExif(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return false;
  }

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;

    const hi = bytes[offset + 2];
    const lo = bytes[offset + 3];
    if (hi === undefined || lo === undefined) break;
    const segmentLength = (hi << 8) | lo;
    if (segmentLength < 2) break;

    const segmentStart = offset + 4;
    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > bytes.length) break;

    if (marker === 0xe1) {
      const header = bytes.slice(segmentStart, segmentStart + 6);
      const isExif =
        header[0] === 0x45 &&
        header[1] === 0x78 &&
        header[2] === 0x69 &&
        header[3] === 0x66 &&
        header[4] === 0x00 &&
        header[5] === 0x00;
      if (isExif) {
        const exif = bytes.slice(segmentStart, segmentEnd);
        const view = new DataView(exif.buffer, exif.byteOffset, exif.byteLength);
        for (let i = 0; i + 1 < exif.length; i++) {
          if (view.getUint16(i, false) === 0x8825) return true;
        }
        const ascii = new TextDecoder('latin1').decode(exif);
        if (ascii.includes('GPSLatitude') || ascii.includes('GPSLongitude')) {
          return true;
        }
      }
    }

    offset = segmentEnd;
  }

  return wholeFileMayContainGps(bytes);
}

function wholeFileMayContainGps(bytes: Uint8Array): boolean {
  const ascii = new TextDecoder('latin1').decode(bytes);
  return ascii.includes('GPSLatitude') || ascii.includes('GPSLongitude');
}
