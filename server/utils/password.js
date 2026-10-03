'use strict';

/**
 * Password hashing for LoanLens accounts.
 *
 * Uses Node's built-in `crypto.scryptSync` (a memory-hard key derivation
 * function) so no third party dependency is required. Every password gets its
 * own random salt and verification is constant time.
 */

const crypto = require('crypto');

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Derive a salted scrypt hash for a plaintext password. */
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return { salt, hash };
}

/** Constant-time comparison of a candidate password against a stored hash. */
function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  try {
    const derived = crypto.scryptSync(String(password), String(salt), KEY_LENGTH);
    const expected = Buffer.from(String(hash), 'hex');
    if (expected.length !== derived.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch (error) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
