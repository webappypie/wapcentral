import crypto from 'node:crypto';

/**
 * Generates an HMAC-SHA256 signature for a promotion payload.
 * Canonicalizes fields in deterministic order (sorted keys) before signing.
 */
export function generatePayloadSignature(payload: Record<string, unknown>, secret: string): string {
  const keys = Object.keys(payload)
    .filter((k) => k !== 'signature' && payload[k] !== undefined)
    .sort();

  const canonicalString = keys.map((k) => `${k}:${String(payload[k])}`).join('|');

  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature on a delivered promotion payload using timing-safe equality.
 */
export function verifyPayloadSignature(
  payload: Record<string, unknown> & { signature: string },
  secret: string,
): boolean {
  if (!payload.signature || typeof payload.signature !== 'string') {
    return false;
  }

  const expectedSignature = generatePayloadSignature(payload, secret);
  const actualBuffer = Buffer.from(payload.signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
