'use strict';

/**
 * Bearer-token authentication middleware.
 *
 * `requireAuth` verifies the signed token, loads the user and attaches a small
 * `req.user` object ({ id, name, email, role }). It never trusts client-supplied
 * identity data, so every downstream query can be scoped to the real owner.
 */

const { verifyToken } = require('../utils/token');
const userRepository = require('../services/userRepository');
const logger = require('../utils/logger');

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function unauthorized(res, message = 'Please sign in to continue.') {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message }
  });
}

async function requireAuth(req, res, next) {
  try {
    const payload = verifyToken(extractToken(req));
    if (!payload) return unauthorized(res, 'Your session is missing or has expired. Please sign in again.');

    const user = await userRepository.findById(payload.sub);
    if (!user) return unauthorized(res, 'Your account could not be found. Please sign in again.');

    req.user = { id: String(user.id), name: user.name, email: user.email, role: user.role };
    return next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error.message}`);
    return unauthorized(res);
  }
}

module.exports = { requireAuth, extractToken };
