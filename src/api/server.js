'use strict';

const app = require('./app');
const config = require('../core/config');
const { getDatabase, disconnectDatabase } = require('../core/database');
const { getRedis, disconnectRedis } = require('../core/redis');
const { scheduleAutoCloseJob } = require('../infrastructure/workers/queue');

// Workers (start them listening)
require('../infrastructure/workers/email.worker');
require('../infrastructure/workers/pdf.worker');
require('../infrastructure/workers/attendance.worker');

const PORT = config.port;

async function start() {
  try {
    // Verify DB connection
    const db = getDatabase();
    await db.$connect();
    console.info('✅  Database connected');

    // Verify Redis connection and schedule background jobs
    const redis = getRedis();
    try {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      // Schedule background jobs
      await scheduleAutoCloseJob();
    } catch (redisErr) {
      if (redisErr.message.includes('already connecting')) {
        // It was already connected by worker startup, which is safe.
        try {
          await scheduleAutoCloseJob();
        } catch (_) {}
      } else {
        console.warn('⚠️  Redis connection failed. Background job queues (email notifications, PDF passport generation) will be disabled. Core routes will still work.');
        console.warn(`    Details: ${redisErr.message}`);
      }
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.info(`🚀  Server running on http://localhost:${PORT}${config.apiPrefix}`);
      console.info(`    Environment: ${config.env}`);
    });

    // ─── Graceful Shutdown ──────────────────────────────────
    const shutdown = async (signal) => {
      console.info(`\n⚠️   ${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        await disconnectRedis();
        console.info('✅  Shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors (log but don't crash in prod)
    process.on('unhandledRejection', (reason) => {
      console.error('⚠️   Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('❌  Uncaught Exception:', err);
      shutdown('uncaughtException');
    });
  } catch (err) {
    console.error('❌  Failed to start server:', err);
    process.exit(1);
  }
}

start();
