'use strict';

/**
 * Authentication routes.
 *   POST /api/auth/register  create an account and return a session token
 *   POST /api/auth/login     exchange credentials for a session token
 *   GET  /api/auth/me        current user (requires a valid token)
 */

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/authController');

const router = express.Router();

router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.get('/me', requireAuth, asyncHandler(controller.me));

module.exports = router;
