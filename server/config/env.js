'use strict';

/**
 * Centralised runtime configuration.
 *
 * Values are read from the repository root `.env` first and then from
 * `server/.env` (which wins when both exist). Loading is optional so the
 * project still boots with sensible defaults for local demo usage.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
if (fs.existsSync(serverEnv)) {
  dotenv.config({ path: serverEnv, override: true });
}

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const maxUploadMb = toInt(process.env.MAX_UPLOAD_MB, 20);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  mongoUri: (process.env.MONGODB_URI || '').trim(),

  mlServiceUrl: (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
  mlTimeoutMs: toInt(process.env.ML_TIMEOUT_MS, 60000),

  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxUploadMb,
  maxUploadBytes: maxUploadMb * 1024 * 1024,

  demoMode: toBool(process.env.DEMO_MODE, true),
  seedDemoData: toBool(process.env.SEED_DEMO_DATA, true)
};

module.exports = config;
