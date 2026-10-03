'use strict';

/**
 * User repository.
 *
 * Mirrors `agreementRepository`: MongoDB when a connection is available,
 * otherwise an in-memory Map so sign-up/sign-in still work end-to-end without a
 * database installed. Records always present a sanitised shape (no hash/salt).
 */

const User = require('../models/User');
const { isDbConnected } = require('../config/db');
const { randomId } = require('../utils/sanitize');
const logger = require('../utils/logger');

/** In-memory fallback store. */
const memory = new Map();

/** Remove secrets and normalise ids before a record leaves the repository. */
const normalise = (doc) => {
  if (!doc) return null;
  const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  plain.id = String(plain.id || plain._id || randomId());
  delete plain._id;
  delete plain.__v;
  delete plain.passwordHash;
  delete plain.passwordSalt;
  return plain;
};

/**
 * Internal lookup that keeps the hash/salt for password verification.
 *
 * `toJSON()` deliberately strips the secrets (see the schema transform), so the
 * private shape is built from `toObject()` and the credentials are read off the
 * document itself. Without this, sign-in could never succeed.
 */
const normalisePrivate = (doc) => {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  plain.passwordHash = doc.passwordHash;
  plain.passwordSalt = doc.passwordSalt;
  plain.id = String(plain.id || plain._id || randomId());
  delete plain._id;
  delete plain.__v;
  return plain;
};

async function create(data) {
  const payload = {
    name: String(data.name || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    passwordHash: data.passwordHash,
    passwordSalt: data.passwordSalt,
    role: data.role || 'Borrower',
    lastLoginAt: null
  };

  if (isDbConnected()) {
    const created = await User.create(payload);
    return normalise(created);
  }

  const id = randomId();
  const record = {
    ...payload,
    _id: id,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  memory.set(id, record);
  return normalise(record);
}

/** Look up a user by email, returning the private record (hash + salt). */
async function findByEmail(email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return null;

  if (isDbConnected()) {
    return normalisePrivate(await User.findOne({ email: needle }));
  }

  for (const record of memory.values()) {
    if (record.email === needle) return normalisePrivate(record);
  }
  return null;
}

async function findById(id) {
  if (!id) return null;

  if (isDbConnected()) {
    if (!/^[a-f\d]{24}$/i.test(String(id))) return null;
    return normalise(await User.findById(id));
  }
  return normalise(memory.get(String(id)));
}

/** Record the time of a successful sign-in. */
async function touchLogin(id) {
  if (!id) return null;
  const now = new Date();

  if (isDbConnected()) {
    if (!/^[a-f\d]{24}$/i.test(String(id))) return null;
    const updated = await User.findByIdAndUpdate(id, { lastLoginAt: now }, { new: true });
    return normalise(updated);
  }

  const record = memory.get(String(id));
  if (!record) return null;
  const next = { ...record, lastLoginAt: now.toISOString(), updatedAt: now.toISOString() };
  memory.set(String(id), next);
  return normalise(next);
}

async function count() {
  if (isDbConnected()) return User.countDocuments({});
  return memory.size;
}

async function clearAll() {
  if (isDbConnected()) {
    await User.deleteMany({});
  } else {
    memory.clear();
  }
  logger.debug('User store cleared.');
}

module.exports = {
  create,
  findByEmail,
  findById,
  touchLogin,
  count,
  clearAll,
  isPersistent: () => isDbConnected()
};
