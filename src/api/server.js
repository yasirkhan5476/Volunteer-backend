'use strict';

const app = require('./app');
const config = require('../core/config');
const { getDatabase, disconnectDatabase } = require('../core/database');
const { getRedis, disconnectRedis } = require('../core/redis');

const PORT = config.port;

// If executing inside Vercel, export express app directly without starting HTTP listeners or worker threads
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Local Development & Dedicated Node Server Execution
  const { scheduleAutoCloseJob } = require('../infrastructure/workers/queue');
  require('../infrastructure/workers/email.worker');
  require('../infrastructure/workers/pdf.worker');
  require('../infrastructure/workers/attendance.worker');

  async function start() {
    try {
      const db = getDatabase();
      await db.$connect();
      console.info('✅ Database connected');

      const redis = getRedis();
      try {
        if (redis.status === 'wait') {
          await redis.connect();
        }
        await scheduleAutoCloseJob();
      } catch (redisErr) {
        console.warn('⚠️ Redis skipped:', redisErr.message);
      }

      const server = app.listen(PORT, () => {
        console.info(`🚀 Server running on http://localhost:${PORT}${config.apiPrefix}`);
      });

      const shutdown = async (signal) => {
        console.info(`\n⚠️ ${signal} received — shutting down...`);
        server.close(async () => {
          await disconnectDatabase();
          await disconnectRedis();
          process.exit(0);
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
  }

  start();
}