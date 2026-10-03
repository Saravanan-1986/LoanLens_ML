'use strict';

/**
 * Minimal, dependency-free signed session tokens.
 *
 * A token is `base64url(payload).base64url(HMAC-SHA256(payload))`. The payload
 * carries the user id, display name and an expiry. It is validated with a
 * constant-time comparison and rejected once expired, so a stolen token cannot
 * be used forever. This is intentionally simple (no external JWT library) and
 * is sufficient for the single-service LoanLens deployment.
 */

const crypto = require('crypto');
const config = require('../config/env');

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function signatureFor(encodedPayload) {
  return crypto.createHmac('sha256', config.authSecret).update(encodedPayload).digest('base64url');
}

/** Issue a signed token for a user record. */
function createToken(user) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + config.authTokenTtlHours * 60 * 60 * 1000;
  const payload = {
    sub: String(user.id),
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'Borrower',
    iat: issuedAt,
    exp: expiresAt
  };
  const encoded = encode(payload);
  return { token: `${encoded}.${signatureFor(encoded)}`, expiresAt };
}

/** Verify a token and return its payload, or `null` when invalid/expired. */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, providedSignature] = parts;
  const expectedSignature = signatureFor(encoded);

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || !payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

module.exports = { createToken, verifyToken };
