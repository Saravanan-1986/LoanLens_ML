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

  // Demo/pre-seeded sample data is disabled by default: the library and history
  // must only ever contain real analyses. `purgeDemoData` removes any demo
  // records left over from an older build the next time the server boots.
  demoMode: toBool(process.env.DEMO_MODE, false),
  seedDemoData: toBool(process.env.SEED_DEMO_DATA, false),
  purgeDemoData: toBool(process.env.PURGE_DEMO_DATA, true),

  // ---------------------------------------------------------------------------
  // Authentication
  // AUTH_SECRET signs the session tokens (HMAC-SHA256). Set a long, random
  // value in production; the fallback keeps local development working.
  // ---------------------------------------------------------------------------
  authSecret:
    (process.env.AUTH_SECRET || 'loanlens-local-dev-secret-please-change').trim(),
  authTokenTtlHours: toInt(process.env.AUTH_TOKEN_TTL_HOURS, 24 * 7)
};

module.exports = config;
