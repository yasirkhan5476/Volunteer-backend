'use strict';

const { NotFoundError, UnprocessableError } = require('../../../core/exceptions');
const { isWithinGeofence } = require('../../../domain/services/geofence.service');
const { AttendanceEntity } = require('../../../domain/entities/attendance');

/**
 * Check-In Use Case
 *
 * 1. Validates the event exists and is currently ongoing.
 * 2. Verifies the volunteer's GPS coordinates are within the event geofence.
 * 3. Prevents duplicate active check-ins.
 * 4. Creates the attendance record.
 */
class CheckInUseCase {
  constructor({ eventRepository, attendanceRepository }) {
    this.eventRepository = eventRepository;
    this.attendanceRepository = attendanceRepository;
  }

  /**
   * @param {string} userId
   * @param {{ eventId: string, latitude: number, longitude: number }} dto
   * @returns {Promise<AttendanceEntity>}
   */
  async execute(userId, dto) {
    // 1. Load event
    const event = await this.eventRepository.findById(dto.eventId);
    if (!event || !event.isActive) throw new NotFoundError('Event');

    // 2. Event must be ongoing
    const now = new Date();
    if (now < new Date(event.startTime)) {
      throw new UnprocessableError('Event has not started yet');
    }
    if (now > new Date(event.endTime)) {
      throw new UnprocessableError('Event has already ended');
    }

    // 3. Geofence check
    const inZone = isWithinGeofence(
      { latitude: dto.latitude, longitude: dto.longitude },
      {
        latitude: event.latitude,
        longitude: event.longitude,
        radiusMeters: event.radiusMeters,
      }
    );

    if (!inZone) {
      throw new UnprocessableError(
        `You must be within ${event.radiusMeters} meters of the event location to check in`
      );
    }

    // 4. No active check-in for this event already
    const active = await this.attendanceRepository.findActiveCheckIn(userId, dto.eventId);
    if (active) {
      throw new UnprocessableError('You are already checked in to this event');
    }

    // 5. Create attendance record
    const attendance = await this.attendanceRepository.create({
      userId,
      eventId: dto.eventId,
      checkInLat: dto.latitude,
      checkInLng: dto.longitude,
      status: 'CHECKED_IN',
    });

    return new AttendanceEntity(attendance);
  }
}

module.exports = { CheckInUseCase };
