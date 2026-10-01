'use strict';

/**
 * Multer upload configuration.
 *
 * Files land in the configured upload directory with a sanitised, unique name.
 * The real validation (magic bytes, size, password protection) happens in
 * `documentService.validateUpload` after the upload is written to disk, because
 * only then can the content be inspected.
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config/env');
const { sanitizeFilename } = require('../utils/sanitize');

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const safe = sanitizeFilename(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (extension !== '.pdf') {
      const error = new Error('Only PDF files are supported. Please upload a .pdf document.');
      error.statusCode = 415;
      error.code = 'INVALID_TYPE';
      return cb(error);
    }
    return cb(null, true);
  }
});

/** Wraps multer so its errors become friendly, consistent API responses. */
function uploadSingle(fieldName = 'file') {
  const handler = upload.single(fieldName);

  return (req, res, next) => {
    handler(req, res, (error) => {
      if (!error) return next();

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          error.statusCode = 413;
          error.code = 'FILE_TOO_LARGE';
          error.message = `The file is larger than the ${config.maxUploadMb} MB limit.`;
        } else {
          error.statusCode = 400;
          error.code = error.code || 'UPLOAD_ERROR';
          error.message = 'The upload could not be processed. Please try again.';
        }
      }
      return next(error);
    });
  };
}

module.exports = { uploadSingle };
