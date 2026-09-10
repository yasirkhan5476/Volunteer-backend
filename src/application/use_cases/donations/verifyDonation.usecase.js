'use strict';

const { NotFoundError, ForbiddenError } = require('../../../core/exceptions');
const { DonationEntity } = require('../../../domain/entities/donation');

class VerifyDonationUseCase {
  constructor({ donationRepository, paymentGatewayFactory }) {
    this.donationRepository = donationRepository;
    this.paymentGatewayFactory = paymentGatewayFactory;
  }

  async execute(user, donationId) {
    const donation = await this.donationRepository.findByOrderIdOrGatewayRef(donationId);
    if (!donation) throw new NotFoundError('Donation');
    if (donation.userId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenError();
    }

    // The webhook is the only source of truth. A checkout redirect or a
    // provider status query must never complete a donation on its own.
    return new DonationEntity(donation);
  }
}

module.exports = { VerifyDonationUseCase };
