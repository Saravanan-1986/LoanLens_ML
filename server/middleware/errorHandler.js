'use strict';

/**
 * Central error handler.
 *
 * Clients receive a short, user friendly message and a stable error code -
 * never a stack trace or filesystem path.
 */

const config = require('../config/env');
const logger = require('../utils/logger');
const documentService = require('../services/documentService');

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  let statusCode = error.statusCode || error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Something went wrong while processing your request.';

  if (error instanceof documentService.DocumentError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contained invalid data.';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'The identifier in the request is not valid.';
  } else if (statusCode >= 500) {
    message = 'Something went wrong on our side. Please try again in a moment.';
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.message}`);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message },
    ...(config.env === 'development' && statusCode >= 500 ? { detail: error.message } : {})
  });
}

module.exports = errorHandler;
