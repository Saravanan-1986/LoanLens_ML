'use strict';

/**
 * Uploaded document validation + cleanup helpers.
 *
 * Everything a user can influence (name, size, content) is checked here before
 * the file is allowed into the analysis pipeline.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/env');

/** `%PDF-` magic bytes - a real PDF must start with these. */
const PDF_MAGIC = Buffer.from('%PDF-');

/** Text below this character count is treated as "not extractable" (needs OCR). */
const MIN_USABLE_TEXT_CHARS = 400;

/** PDFs that are encrypted typically announce themselves like this. */
const ENCRYPTION_HINTS = [/\/Encrypt\b/, /\/EncryptMetadata\b/];

class DocumentError extends Error {
  constructor(message, statusCode = 400, code = 'DOCUMENT_ERROR') {
    super(message);
    this.name = 'DocumentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Validate an uploaded file: extension, mime type, size and magic bytes. */
async function validateUpload(file) {
  if (!file) {
    throw new DocumentError('No file was received. Please attach a PDF and try again.', 400, 'NO_FILE');
  }

  const extension = path.extname(file.originalname || '').toLowerCase();
  if (extension !== '.pdf') {
    throw new DocumentError('Only PDF files are supported. Please upload a document with a .pdf extension.', 415, 'INVALID_TYPE');
  }

  if (file.mimetype && file.mimetype !== 'application/pdf' && file.mimetype !== 'application/octet-stream') {
    throw new DocumentError('The uploaded file does not look like a PDF document.', 415, 'INVALID_MIME');
  }

  if (!file.size) {
    throw new DocumentError('The uploaded file is empty. Please choose a PDF that contains your agreement.', 400, 'EMPTY_FILE');
  }

  if (file.size > config.maxUploadBytes) {
    throw new DocumentError(`The file is larger than the ${config.maxUploadMb} MB limit.`, 413, 'FILE_TOO_LARGE');
  }

  const handle = await fs.promises.open(file.path, 'r');
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, 5, 0);
    if (bytesRead < 5 || !header.equals(PDF_MAGIC)) {
      throw new DocumentError('This file is not a valid PDF. The document may be corrupted.', 400, 'CORRUPT_PDF');
    }
  } finally {
    await handle.close();
  }

  return true;
}

/**
 * Detect whether a PDF is likely encrypted/password protected by scanning the
 * raw bytes for an /Encrypt dictionary entry.
 */
async function isPasswordProtected(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const chunk = Buffer.alloc(Math.min(size, 512 * 1024));
    await handle.read(chunk, 0, chunk.length, 0);
    return ENCRYPTION_HINTS.some((pattern) => pattern.test(chunk.toString('latin1')));
  } finally {
    await handle.close();
  }
}

/** True when extracted text is too short to be segmented reliably. */
function needsOcr(text) {
  return String(text || '').replace(/\s/g, '').length < MIN_USABLE_TEXT_CHARS;
}

/** Remove a temporary upload while ignoring "already gone" races. */
async function removeFile(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

/** Human readable file size, used in API responses. */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

module.exports = {
  DocumentError,
  validateUpload,
  isPasswordProtected,
  needsOcr,
  removeFile,
  formatBytes,
  MIN_USABLE_TEXT_CHARS
};
