'use strict';

/** Health + capability probe used by the frontend and monitoring. */

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { getDbStatus } = require('../config/db');
const mlService = require('../services/mlService');
const config = require('../config/env');
const pkg = require('../package.json');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mlAvailable = await mlService.isAvailable();
    const db = getDbStatus();

    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'loanlens-server',
        version: pkg.version,
        environment: config.env,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        dependencies: {
          mlService: { url: mlService.baseUrl, available: mlAvailable },
          database: db,
          storage: db.connected ? 'mongodb' : 'in-memory'
        }
      }
    });
  })
);

module.exports = router;
