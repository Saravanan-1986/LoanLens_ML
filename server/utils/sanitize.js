'use strict';

/**
 * Shared helpers for turning untrusted client input into something safe to
 * store, log or read back on the filesystem.
 */

const path = require('path');
const crypto = require('crypto');

/**
 * Produce a filesystem-safe version of an uploaded file name.
 * Keeps letters, digits, dot, dash and underscore only.
 */
function sanitizeFilename(name) {
  const base = path.basename(String(name || 'agreement.pdf'));
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
    .slice(-120);
  return cleaned || 'agreement.pdf';
}

/** Collapse whitespace and strip null bytes so text is safe to persist. */
function sanitizeText(text, maxLength = 20000) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, maxLength);
}

/** Hard length cap for user supplied strings (search terms, names...). */
function clampString(value, maxLength = 200) {
  return String(value === undefined || value === null ? '' : value).slice(0, maxLength).trim();
}

/** Random, collision-free identifier used by the in-memory store. */
function randomId() {
  return crypto.randomUUID();
}

/** Escape a string so it can be embedded in a RegExp safely. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  sanitizeFilename,
  sanitizeText,
  clampString,
  randomId,
  escapeRegex
};
