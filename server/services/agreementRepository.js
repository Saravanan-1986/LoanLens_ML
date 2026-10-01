'use strict';

/**
 * Agreement repository.
 *
 * Exposes one small async API used by the controllers and pipeline. Records are
 * stored in MongoDB when a connection is available, otherwise in an in-memory
 * Map so the whole application still works end-to-end (handy for demos and
 * for environments where MongoDB is not installed).
 */

const Agreement = require('../models/Agreement');
const { isDbConnected } = require('../config/db');
const { randomId } = require('../utils/sanitize');
const logger = require('../utils/logger');

/** In-memory fallback store. */
const memory = new Map();

const normalise = (doc) => {
  if (!doc) return null;
  const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  plain.id = String(plain.id || plain._id || randomId());
  delete plain._id;
  delete plain.__v;
  return plain;
};

const sortByUploadedAtDesc = (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt);

async function create(data) {
  const payload = {
    ...data,
    uploadedAt: data.uploadedAt || new Date(),
    status: data.status || 'uploaded'
  };

  if (isDbConnected()) {
    const created = await Agreement.create(payload);
    return normalise(created);
  }

  const id = randomId();
  const record = {
    _id: id,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...payload
  };
  memory.set(id, record);
  return normalise(record);
}

async function findById(id) {
  if (!id) return null;
  if (isDbConnected()) {
    if (!/^[a-f\d]{24}$/i.test(String(id))) return null;
    return normalise(await Agreement.findById(id));
  }
  return normalise(memory.get(String(id)));
}

async function list(options = {}) {
  const { status, limit = 100, includeDemo = true } = options;

  if (isDbConnected()) {
    const query = {};
    if (status) query.status = status;
    if (!includeDemo) query.isDemo = { $ne: true };
    const docs = await Agreement.find(query)
      .sort({ uploadedAt: -1 })
      .limit(Number(limit) || 100)
      .lean();
    return docs.map(normalise).sort(sortByUploadedAtDesc);
  }

  return [...memory.values()]
    .filter((doc) => (status ? doc.status === status : true))
    .filter((doc) => (includeDemo ? true : !doc.isDemo))
    .map(normalise)
    .sort(sortByUploadedAtDesc)
    .slice(0, Number(limit) || 100);
}

/**
 * Update a record. `updater` may be a plain patch object or a function that
 * receives the current record and returns the next one.
 */
async function update(id, updater) {
  if (!id) return null;

  if (isDbConnected()) {
    const current = await Agreement.findById(id);
    if (!current) return null;
    const patch = typeof updater === 'function' ? updater(normalise(current)) : updater;
    Object.assign(current, patch, { updatedAt: new Date() });
    if (patch.stages) current.markModified('stages');
    if (patch.clauses) current.markModified('clauses');
    if (patch.riskSummary) current.markModified('riskSummary');
    await current.save();
    return normalise(current);
  }

  const current = memory.get(String(id));
  if (!current) return null;
  const patch = typeof updater === 'function' ? updater(normalise(current)) : updater;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  memory.set(String(id), next);
  return normalise(next);
}

async function remove(id) {
  if (!id) return null;

  if (isDbConnected()) {
    if (!/^[a-f\d]{24}$/i.test(String(id))) return null;
    return normalise(await Agreement.findByIdAndDelete(id));
  }

  const record = memory.get(String(id));
  if (!record) return null;
  memory.delete(String(id));
  return normalise(record);
}

async function count(filter = {}) {
  if (isDbConnected()) return Agreement.countDocuments(filter);
  return [...memory.values()].filter((doc) => {
    if (filter.status && doc.status !== filter.status) return false;
    if (filter.isDemo === true && doc.isDemo !== true) return false;
    return true;
  }).length;
}

async function clearAll() {
  if (isDbConnected()) {
    await Agreement.deleteMany({});
  } else {
    memory.clear();
  }
  logger.debug('Agreement store cleared.');
}

module.exports = {
  create,
  findById,
  list,
  update,
  remove,
  count,
  clearAll,
  isPersistent: () => isDbConnected()
};
