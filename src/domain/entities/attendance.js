'use strict';

/**
 * Attendance Entity — tracks a volunteer's presence at an event.
 */
class AttendanceEntity {
  constructor({
    id,
    userId,
    eventId,
    checkInLat,
    checkInLng,
    checkOutLat,
    checkOutLng,
    checkInTime,
    checkOutTime,
    hoursLogged,
    status,
    createdAt,
  }) {
    this.id = id;
    this.userId = userId;
    this.eventId = eventId;
    this.checkInLat = checkInLat;
    this.checkInLng = checkInLng;
    this.checkOutLat = checkOutLat || null;
    this.checkOutLng = checkOutLng || null;
    this.checkInTime = new Date(checkInTime);
    this.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
    this.hoursLogged = hoursLogged || null;
    this.status = status;
    this.createdAt = createdAt;
  }

  isCheckedIn() {
    return this.status === 'CHECKED_IN';
  }

  isCheckedOut() {
    return this.status === 'CHECKED_OUT' || this.status === 'AUTO_CLOSED';
  }

  /**
   * Calculate hours logged between check-in and check-out.
   * @returns {number} hours (2 decimal places)
   */
  calculateHours() {
    if (!this.checkOutTime) return 0;
    const ms = this.checkOutTime - this.checkInTime;
    return Math.round((ms / 1000 / 3600) * 100) / 100;
  }
}

module.exports = { AttendanceEntity };
