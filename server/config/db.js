'use strict';

/**
 * MongoDB connection helper.
 *
 * If `MONGODB_URI` is missing or MongoDB is unreachable the application keeps
 * working through the in-memory repository (see services/agreementRepository),
 * so the full pipeline can be demonstrated without any database installed.
 */

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

let lastError = null;

async function connectDb() {
  if (!config.mongoUri) {
    logger.warn('MONGODB_URI is not set - using the in-memory agreement store.');
    return false;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    lastError = null;
    logger.info(`MongoDB connected (${mongoose.connection.name}).`);
    return true;
  } catch (error) {
    lastError = error.message;
    logger.warn(`MongoDB unavailable (${error.message}) - falling back to the in-memory store.`);
    return false;
  }
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

function getDbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    configured: Boolean(config.mongoUri),
    connected: isDbConnected(),
    state: states[mongoose.connection.readyState] || 'unknown',
    error: lastError
  };
}

async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

module.exports = { connectDb, disconnectDb, isDbConnected, getDbStatus };
