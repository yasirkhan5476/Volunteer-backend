'use strict';

const { NotFoundError, ForbiddenError, UnprocessableError } = require('../../../core/exceptions');
const { AttendanceEntity } = require('../../../domain/entities/attendance');

/**
 * Check-Out Use Case
 *
 * 1. Finds the active attendance record.
 * 2. Ensures the requester owns the attendance record.
 * 3. Records the checkout time and calculates hours logged.
 * 4. Updates volunteer's total hours in their profile.
 */
class CheckOutUseCase {
  constructor({ attendanceRepository, userRepository }) {
    this.attendanceRepository = attendanceRepository;
    this.userRepository = userRepository;
  }

  /**
   * @param {string} userId
   * @param {{ attendanceId: string, latitude: number, longitude: number }} dto
   * @returns {Promise<AttendanceEntity>}
   */
  async execute(userId, dto) {
    // 1. Find the attendance record
    const record = await this.attendanceRepository.findById(dto.attendanceId);
    if (!record) throw new NotFoundError('Attendance record');

    // 2. Ownership check
    if (record.userId !== userId) throw new ForbiddenError();

    // 3. Must be in CHECKED_IN state
    if (record.status !== 'CHECKED_IN') {
      throw new UnprocessableError('You are not currently checked in');
    }

    // 4. Calculate hours
    const checkOutTime = new Date();
    const hoursLogged =
      Math.round(((checkOutTime - new Date(record.checkInTime)) / 1000 / 3600) * 100) / 100;

    // 5. Update attendance
    const updated = await this.attendanceRepository.update(dto.attendanceId, {
      checkOutLat: dto.latitude,
      checkOutLng: dto.longitude,
      checkOutTime,
      hoursLogged,
      status: 'CHECKED_OUT',
    });

    // 6. Increment volunteer's total hours
    await this.userRepository.incrementTotalHours(userId, hoursLogged);

    return new AttendanceEntity(updated);
  }
}

module.exports = { CheckOutUseCase };
