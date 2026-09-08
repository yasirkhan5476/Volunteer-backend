'use strict';

const { NotFoundError } = require('../../../core/exceptions');

/**
 * Process Webhook Use Case
 *
 * Handles inbound payment gateway callbacks to update donation status.
 */
class ProcessWebhookUseCase {
  constructor({ donationRepository, paymentGatewayFactory }) {
    this.donationRepository = donationRepository;
    this.paymentGatewayFactory = paymentGatewayFactory;
  }

  /**
   * @param {string} gatewayName - 'SAFE_PAY'
   * @param {object} body - Raw webhook body
   * @param {object} headers - Webhook headers (for signature verification)
   * @returns {Promise<{ success: boolean, donationId: string, status: string }>}
   */
  async execute(gatewayName, body, headers, parsedBody) {
    const gateway = this.paymentGatewayFactory.get(gatewayName.toUpperCase());
    const parsed = await gateway.parseWebhook(body, headers, parsedBody);

    // payment:created only opens the checkout session; it is not a payment result.
    if (parsed.eventType === 'payment:created') {
      return { success: true, status: 'IGNORED_INITIATION_EVENT' };
    }

    // Find donation by gateway reference (tracker) or orderId / id
    let donation = parsed.gatewayRef ? await this.donationRepository.findByGatewayRef(parsed.gatewayRef) : null;
    if (!donation && parsed.orderId) {
      donation = await this.donationRepository.findById(parsed.orderId);
    }
    if (!donation && parsed.gatewayRef) {
      donation = await this.donationRepository.findById(parsed.gatewayRef);
    }
    if (!donation) throw new NotFoundError('Donation');

    // Map gateway status to our internal status
    const statusMap = {
      COMPLETED: 'COMPLETED',
      SUCCESS: 'COMPLETED',
      PAID: 'COMPLETED',
      TRACKER_ENDED: 'COMPLETED',
      FAILED: 'FAILED',
      CANCELLED: 'FAILED',
      REFUNDED: 'REFUNDED',
    };

    const newStatus = statusMap[parsed.status.toUpperCase()];

    if (!newStatus) {
      return { success: true, donationId: donation.id, status: 'PENDING' };
    }

    await this.donationRepository.update(donation.id, {
      status: newStatus,
      gatewayMeta: { ...(donation.gatewayMeta || {}), ...parsed.meta },
    });

    return { success: true, donationId: donation.id, status: newStatus };
  }
}

module.exports = { ProcessWebhookUseCase };
