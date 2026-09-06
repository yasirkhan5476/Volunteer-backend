'use strict';

const { BaseRepository } = require('../../../domain/interfaces/repositories');
const { getDatabase } = require('../../../core/database');

class EventRepository extends BaseRepository {
  constructor() {
    super();
    this.db = getDatabase();
  }

  async findById(id) {
    return this.db.event.findUnique({
      where: { id },
      include: { organization: true, createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async findAll(filters = {}) {
    const { organizationId, isActive, page = 1, limit = 20 } = filters;
    const [data, total] = await Promise.all([
      this.db.event.findMany({
        where: {
          ...(organizationId && { organizationId }),
          ...(isActive !== undefined && { isActive }),
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startTime: 'asc' },
        include: { organization: { select: { id: true, name: true } } },
      }),
      this.db.event.count({
        where: {
          ...(organizationId && { organizationId }),
          ...(isActive !== undefined && { isActive }),
        },
      }),
    ]);
    return { data, total, page, limit };
  }

  async create(data) {
    return this.db.event.create({ data });
  }

  async update(id, data) {
    return this.db.event.update({ where: { id }, data });
  }

  async delete(id) {
    return this.db.event.delete({ where: { id } });
  }
}

module.exports = { EventRepository };
