'use strict';

/** Tiny timestamped console logger - keeps output readable and dependency free. */

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

const write = (level, message, meta) => {
  const line = `[${stamp()}] ${level.toUpperCase().padEnd(5)} ${message}`;
  const stream = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) stream(line, meta);
  else stream(line);
};

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => {
    if (process.env.DEBUG) write('debug', message, meta);
  }
};
