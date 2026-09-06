'use strict';

const { NotFoundError, ForbiddenError } = require('../../../core/exceptions');
const { DonationEntity } = require('../../../domain/entities/donation');

class VerifyDonationUseCase {
  constructor({ donationRepository, paymentGatewayFactory }) {
    this.donationRepository = donationRepository;
    this.paymentGatewayFactory = paymentGatewayFactory;
  }

  async execute(user, donationId) {
    const donation = await this.donationRepository.findById(donationId);
    if (!donation) throw new NotFoundError('Donation');
    if (donation.userId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenError();
    }

    if (!donation.gatewayRef || donation.status !== 'PENDING') {
      return new DonationEntity(donation);
    }

    const gateway = this.paymentGatewayFactory.get(donation.gateway);
    const result = await gateway.verifyPayment(donation.gatewayRef);
    const nextStatus = result.status === 'COMPLETED'
      ? 'COMPLETED'
      : result.status === 'FAILED'
        ? 'FAILED'
        : 'PENDING';

    if (nextStatus !== donation.status) {
      const updated = await this.donationRepository.update(donation.id, {
        status: nextStatus,
        gatewayMeta: { ...(donation.gatewayMeta || {}), verification: result.meta },
      });
      return new DonationEntity(updated);
    }

    return new DonationEntity(donation);
  }
}

module.exports = { VerifyDonationUseCase };