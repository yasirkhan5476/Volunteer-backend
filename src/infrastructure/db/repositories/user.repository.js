'use strict';

const { BaseRepository } = require('../../../domain/interfaces/repositories');
const { getDatabase } = require('../../../core/database');

class UserRepository extends BaseRepository {
  constructor() {
    super();
    this.db = getDatabase();
  }

  async findById(id) {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByIdWithProfile(id) {
    return this.db.user.findUnique({
      where: { id },
      include: { volunteerProfile: true },
    });
  }

  async findByEmail(email) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findAll(filters = {}) {
    const { role, isActive, page = 1, limit = 20 } = filters;
    return this.db.user.findMany({
      where: {
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { volunteerProfile: true },
    });
  }

  async create(data) {
    return this.db.user.create({ data });
  }

  async getRoleCounts() {
    const rows = await this.db.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });

    const summary = { volunteers: 0, organizers: 0, admins: 0, superAdmins: 0 };

    for (const row of rows) {
      const role = row.role;
      if (role === 'VOLUNTEER') summary.volunteers = row._count.role;
      if (role === 'ORGANIZER') summary.organizers = row._count.role;
      if (role === 'ADMIN') summary.admins = row._count.role;
      if (role === 'SUPER_ADMIN') summary.superAdmins = row._count.role;
    }

    return summary;
  }

  async update(id, data) {
    return this.db.user.update({ where: { id }, data });
  }

  async delete(id) {
    return this.db.user.delete({ where: { id } });
  }

  async createVolunteerProfile(userId) {
    return this.db.volunteerProfile.create({ data: { userId } });
  }

  async upsertVolunteerProfile(userId, data) {
    return this.db.volunteerProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async incrementTotalHours(userId, hours) {
    return this.db.volunteerProfile.updateMany({
      where: { userId },
      data: { totalHours: { increment: hours } },
    });
  }
}

module.exports = { UserRepository };
