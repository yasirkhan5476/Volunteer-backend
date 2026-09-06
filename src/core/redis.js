'use strict';

const Redis = require('ioredis');
const config = require('./config');

/** @type {Redis} */
let redisClient;

/**
 * Returns a singleton ioredis client.
 */
function getRedis() {
  if (!redisClient) {
    const isUpstash = config.redis.host && config.redis.host.includes('.upstash.io');

    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
      ...(isUpstash && { tls: {} }),
    });

    redisClient.on('connect', () => console.info('✅  Redis connected'));
    redisClient.on('error', (err) => console.error('❌  Redis error:', err.message));
    redisClient.on('close', () => console.warn('⚠️   Redis connection closed'));
  }
  return redisClient;
}

/**
 * Gracefully disconnect from Redis.
 */
async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

module.exports = { getRedis, disconnectRedis };
