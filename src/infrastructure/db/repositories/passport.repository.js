'use strict';

const { BaseRepository } = require('../../../domain/interfaces/repositories');
const { getDatabase } = require('../../../core/database');

class PassportRepository extends BaseRepository {
  constructor() {
    super();
    this.db = getDatabase();
  }

  async findById(id) {
    return this.db.passport.findUnique({ where: { id } });
  }

  async findByUserId(userId) {
    return this.db.passport.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async findAll(filters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    return this.db.passport.findMany({
      where: { ...(status && { status }) },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { issuedAt: 'desc' },
    });
  }

  async create(data) {
    return this.db.passport.create({ data });
  }

  async update(id, data) {
    return this.db.passport.update({ where: { id }, data });
  }

  async delete(id) {
    return this.db.passport.delete({ where: { id } });
  }
}

module.exports = { PassportRepository };
