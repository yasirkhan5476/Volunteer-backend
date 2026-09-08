'use strict';

const { PrismaClient } = require('@prisma/client');
const config = require('./config');

/** @type {PrismaClient} */
let prisma;

function getDatabaseUrl() {
  const databaseUrl = new URL(config.db.url);

  if (!databaseUrl.searchParams.has('connection_limit')) {
    databaseUrl.searchParams.set('connection_limit', '5');
  }
  if (!databaseUrl.searchParams.has('pool_timeout')) {
    databaseUrl.searchParams.set('pool_timeout', '20');
  }

  return databaseUrl.toString();
}

/**
 * Returns a singleton Prisma client instance.
 * Uses global to survive hot-reload in development.
 */
function getDatabase() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: getDatabaseUrl() } },
      log: config.isDev ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });
  }
  return prisma;
}

/**
 * Gracefully disconnect from the database.
 */
async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

module.exports = { getDatabase, disconnectDatabase };
