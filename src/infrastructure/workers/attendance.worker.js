'use strict';

const { Worker } = require('bullmq');
const { getRedis } = require('../../core/redis');
const { AttendanceRepository } = require('../db/repositories/attendance.repository');
const { UserRepository } = require('../db/repositories/user.repository');
const { AutoCloseAttendanceJob } = require('../../application/use_cases/attendance/autoClose.job');

const attendanceRepository = new AttendanceRepository();
const userRepository = new UserRepository();
const autoCloseAttendanceJob = new AutoCloseAttendanceJob({ attendanceRepository, userRepository });

const attendanceWorker = new Worker(
  'attendance',
  async (job) => {
    if (job.name !== 'auto-close-attendance') return { skipped: true };
    return autoCloseAttendanceJob.execute();
  },
  {
    connection: getRedis(),
    concurrency: 1,
  },
);

attendanceWorker.on('completed', (job, result) => {
  console.info(`[AttendanceWorker] ${job.name} completed: ${result.closed || 0} record(s) closed`);
});

attendanceWorker.on('failed', (job, error) => {
  console.error(`[AttendanceWorker] Job ${job?.id} failed:`, error.message);
});

module.exports = { attendanceWorker };
