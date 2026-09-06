'use strict';

/**
 * Auto-Close Attendance Job
 *
 * Scheduled BullMQ job that runs periodically (e.g. every hour)
 * to auto-close any CHECKED_IN attendance records for events
 * that have already ended.
 *
 * Scheduled via: src/infrastructure/workers/queue.js
 */
class AutoCloseAttendanceJob {
  constructor({ attendanceRepository, userRepository }) {
    this.attendanceRepository = attendanceRepository;
    this.userRepository = userRepository;
  }

  async execute() {
    const staleRecords = await this.attendanceRepository.findStaleCheckIns();

    if (!staleRecords.length) {
      console.info('[AutoClose] No stale check-ins found.');
      return { closed: 0 };
    }

    let closed = 0;
    for (const record of staleRecords) {
      try {
        const checkOutTime = new Date(record.event.endTime);
        const hoursLogged =
          Math.round(
            ((checkOutTime - new Date(record.checkInTime)) / 1000 / 3600) * 100
          ) / 100;

        await this.attendanceRepository.update(record.id, {
          checkOutTime,
          hoursLogged: Math.max(0, hoursLogged),
          status: 'AUTO_CLOSED',
        });

        await this.userRepository.incrementTotalHours(record.userId, Math.max(0, hoursLogged));
        closed++;
      } catch (err) {
        console.error(`[AutoClose] Failed to close attendance ${record.id}:`, err.message);
      }
    }

    console.info(`[AutoClose] Auto-closed ${closed} attendance record(s).`);
    return { closed };
  }
}

module.exports = { AutoCloseAttendanceJob };
