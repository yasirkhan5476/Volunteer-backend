'use strict';

const { Queue } = require('bullmq');
const { getRedis } = require('../../core/redis');

const connection = getRedis();

// ─── Queue Definitions ───────────────────────────────────────

/** Email notification queue */
const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/** PDF generation queue */
const pdfQueue = new Queue('pdf', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

const donationReceiptQueue = new Queue('donation-receipt', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/** Attendance auto-close scheduled queue */
const attendanceQueue = new Queue('attendance', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

/**
 * Schedule the attendance auto-close job to run every minute.
 * Call this once at application startup.
 */
async function scheduleAutoCloseJob() {
  await attendanceQueue.upsertJobScheduler(
    'auto-close-attendance',
    { every: 60 * 1000 }, // every 1 minute
    { name: 'auto-close-attendance', data: {} }
  );
  console.info('✅  Scheduled attendance auto-close job (every 1 hour)');
}

module.exports = {
  emailQueue,
  pdfQueue,
  donationReceiptQueue,
  attendanceQueue,
  scheduleAutoCloseJob,
};
