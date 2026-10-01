'use strict';

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/dashboardController');

const router = express.Router();

router.get('/stats', asyncHandler(controller.getDashboardStats));
router.get('/meta', asyncHandler(controller.getDashboardMeta));

module.exports = router;
