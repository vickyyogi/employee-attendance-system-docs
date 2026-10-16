export interface MagicBytesResult {
  valid: boolean;
  detectedMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  reason?: string;
}

/**
 * Validate actual binary file signature (magic bytes) to ensure file content
 * matches declared image format and prevents malicious files (scripts, executables, HTML).
 */
export function verifyImageMagicBytes(
  buffer: Buffer,
  expectedMime?: string
): MagicBytesResult {
  if (buffer.length < 12) {
    return { valid: false, reason: 'File buffer too small to determine image signature' };
  }

  // 1. Check JPEG signature (FF D8 FF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (expectedMime && expectedMime !== 'image/jpeg') {
      return {
        valid: false,
        detectedMime: 'image/jpeg',
        reason: `Declared MIME type '${expectedMime}' does not match detected image/jpeg`,
      };
    }
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // 2. Check PNG signature (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (expectedMime && expectedMime !== 'image/png') {
      return {
        valid: false,
        detectedMime: 'image/png',
        reason: `Declared MIME type '${expectedMime}' does not match detected image/png`,
      };
    }
    return { valid: true, detectedMime: 'image/png' };
  }

  // 3. Check WebP signature (RIFF .... WEBP)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    if (expectedMime && expectedMime !== 'image/webp') {
      return {
        valid: false,
        detectedMime: 'image/webp',
        reason: `Declared MIME type '${expectedMime}' does not match detected image/webp`,
      };
    }
    return { valid: true, detectedMime: 'image/webp' };
  }

  return {
    valid: false,
    reason: 'File binary signature does not match any allowed image format (JPEG, PNG, WebP)',
  };
}
