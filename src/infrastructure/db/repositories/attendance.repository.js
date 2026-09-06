'use strict';

const { BaseRepository } = require('../../../domain/interfaces/repositories');
const { getDatabase } = require('../../../core/database');

class AttendanceRepository extends BaseRepository {
  constructor() {
    super();
    this.db = getDatabase();
  }

  async findById(id) {
    return this.db.attendance.findUnique({
      where: { id },
      include: { event: true },
    });
  }

  async findAll(filters = {}) {
    const { userId, eventId, status, page = 1, limit = 20 } = filters;
    return this.db.attendance.findMany({
      where: {
        ...(userId && { userId }),
        ...(eventId && { eventId }),
        ...(status && { status }),
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { checkInTime: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            address: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });
  }

  async findActiveCheckIn(userId, eventId) {
    return this.db.attendance.findFirst({
      where: { userId, eventId, status: 'CHECKED_IN' },
    });
  }

  /**
   * Find all CHECKED_IN records for events that have already ended.
   */
  async findStaleCheckIns() {
    return this.db.attendance.findMany({
      where: {
        status: 'CHECKED_IN',
        event: { endTime: { lt: new Date() } },
      },
      include: { event: true },
    });
  }

  async create(data) {
    return this.db.attendance.create({ data });
  }

  async update(id, data) {
    return this.db.attendance.update({ where: { id }, data });
  }

  async delete(id) {
    return this.db.attendance.delete({ where: { id } });
  }
}

module.exports = { AttendanceRepository };
