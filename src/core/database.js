'use strict';

const { PrismaClient } = require('@prisma/client');
const config = require('./config');

/** @type {PrismaClient} */
let prisma;

/**
 * Returns a singleton Prisma client instance.
 * Uses global to survive hot-reload in development.
 */
function getDatabase() {
  if (!prisma) {
    prisma = new PrismaClient({
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
