'use strict';

const { BaseRepository } = require('../../../domain/interfaces/repositories');
const { getDatabase } = require('../../../core/database');

class DonationRepository extends BaseRepository {
  constructor() {
    super();
    this.db = getDatabase();
  }

  async findById(id) {
    return this.db.donation.findUnique({ where: { id } });
  }

  async findByGatewayRef(gatewayRef) {
    return this.db.donation.findFirst({ where: { gatewayRef } });
  }

  async findAll(filters = {}) {
    const { userId, status, page = 1, limit = 20 } = filters;
    return this.db.donation.findMany({
      where: {
        ...(userId && { userId }),
        ...(status && { status }),
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data) {
    return this.db.donation.create({ data });
  }

  async update(id, data) {
    return this.db.donation.update({ where: { id }, data });
  }

  async delete(id) {
    return this.db.donation.delete({ where: { id } });
  }
}

module.exports = { DonationRepository };
