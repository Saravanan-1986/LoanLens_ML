'use strict';

/**
 * Agreement routes (all require a signed-in user; see server.js).
 */

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { uploadSingle } = require('../middleware/upload');
const controller = require('../controllers/agreementController');

const router = express.Router();

// Create
router.post('/upload', uploadSingle('file'), asyncHandler(controller.uploadAgreement));

// Read
router.get('/', asyncHandler(controller.listAgreements));
router.get('/:id/report', asyncHandler(controller.getAgreementReport));
router.get('/:id', asyncHandler(controller.getAgreement));

// Process
router.post('/:id/analyze', asyncHandler(controller.analyzeAgreement));

// Remove
router.delete('/:id', asyncHandler(controller.deleteAgreement));

module.exports = router;
