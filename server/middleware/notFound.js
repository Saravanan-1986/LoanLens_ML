'use strict';

/** JSON 404 for unknown API routes. */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `No API route matches ${req.method} ${req.originalUrl}`
    }
  });
}

module.exports = notFound;
