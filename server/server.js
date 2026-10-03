'use strict';

/**
 * LoanLens API server entry point.
 *
 * Boots Express, connects to MongoDB (falling back to the in-memory store when
 * MongoDB is unavailable) and optionally seeds clearly-labelled demo data.
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const { connectDb, disconnectDb, getDbStatus } = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { requireAuth } = require('./middleware/auth');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const agreementRoutes = require('./routes/agreements');
const dashboardRoutes = require('./routes/dashboard');

const repository = require('./services/agreementRepository');
const mlService = require('./services/mlService');

const app = express();

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((v) => v.trim()) }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve the built React app when it exists (single-service production deploy).
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

app.get('/api', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'LoanLens API',
      version: require('./package.json').version,
      disclaimer:
        'LoanLens is an awareness and screening tool. It does not provide legal advice.',
      endpoints: [
        'GET    /api/health',
        'POST   /api/auth/register',
        'POST   /api/auth/login',
        'GET    /api/auth/me',
        'GET    /api/dashboard/stats',
        'GET    /api/dashboard/meta',
        'POST   /api/agreements/upload',
        'GET    /api/agreements',
        'GET    /api/agreements/:id',
        'GET    /api/agreements/:id/report',
        'POST   /api/agreements/:id/analyze',
        'DELETE /api/agreements/:id'
      ]
    }
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/agreements', requireAuth, agreementRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

// SPA fallback for the built client (never intercepts /api routes).
if (fs.existsSync(clientDist)) {
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

/* ------------------------------------------------------------------ */
/* Error handling (must be last)                                       */
/* ------------------------------------------------------------------ */

app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */

async function initialiseData() {
  // Demo/sample data is no longer part of the product. Any records created by
  // an older build are removed so the library and history only ever contain
  // real analyses performed by a signed-in user.
  if (!config.purgeDemoData) return;

  try {
    const removed = await repository.removeDemoRecords();
    if (removed) {
      logger.info(`Removed ${removed} legacy demo record(s) from the store.`);
    }
  } catch (error) {
    logger.warn(`Demo cleanup failed: ${error.message}`);
  }
}

async function start() {
  await connectDb();
  await initialiseData();

  mlService
    .isAvailable(true)
    .then((available) => {
      if (available) logger.info(`ML service reachable at ${mlService.baseUrl}.`);
      else
        logger.warn(
          `ML service not reachable at ${mlService.baseUrl} - the server will use its built-in fallback engine.`
        );
    })
    .catch(() => {});

  const server = app.listen(config.port, () => {
    const db = getDbStatus();
    logger.info(`LoanLens API listening on http://localhost:${config.port}`);
    logger.info(`Storage: ${db.connected ? 'MongoDB' : 'in-memory store (no MONGODB_URI)'}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received - shutting down.`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${reason}`));
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
});

if (require.main === module) {
  start();
}

module.exports = { app, start };
