'use strict';

/**
 * Authentication controller: register, login and "who am I".
 *
 * All input is validated here before it touches the repository. Error messages
 * are deliberately uniform on login ("Incorrect email or password.") so they
 * cannot be used to enumerate registered accounts.
 */

const userRepository = require('../services/userRepository');
const { hashPassword, verifyPassword } = require('../utils/password');
const { createToken } = require('../utils/token');
const { clampString } = require('../utils/sanitize');
const logger = require('../utils/logger');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function fail(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function sessionPayload(user, token, expiresAt) {
  return {
    token,
    expiresAt,
    user: { id: String(user.id), name: user.name, email: user.email, role: user.role }
  };
}

/** POST /api/auth/register */
async function register(req, res, next) {
  try {
    const name = clampString(req.body?.name, 80);
    const email = clampString(req.body?.email, 160).toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2) {
      return fail(res, 400, 'INVALID_NAME', 'Please enter your name (at least 2 characters).');
    }
    if (!EMAIL_PATTERN.test(email)) {
      return fail(res, 400, 'INVALID_EMAIL', 'Please enter a valid email address.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return fail(
        res,
        400,
        'WEAK_PASSWORD',
        `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      );
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      return fail(res, 409, 'EMAIL_IN_USE', 'An account with that email already exists. Try signing in.');
    }

    const { salt, hash } = hashPassword(password);
    const user = await userRepository.create({
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt
    });

    const { token, expiresAt } = createToken(user);
    logger.info(`New account created for ${email}.`);

    return res.status(201).json({ success: true, data: sessionPayload(user, token, expiresAt) });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const email = clampString(req.body?.email, 160).toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return fail(res, 400, 'MISSING_CREDENTIALS', 'Please enter your email and password.');
    }

    const record = await userRepository.findByEmail(email);
    if (!record || !verifyPassword(password, record.passwordSalt, record.passwordHash)) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }

    await userRepository.touchLogin(record.id);
    const { token, expiresAt } = createToken(record);

    return res.json({ success: true, data: sessionPayload(record, token, expiresAt) });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/auth/me */
async function me(req, res) {
  return res.json({ success: true, data: { user: req.user } });
}

module.exports = { register, login, me };
