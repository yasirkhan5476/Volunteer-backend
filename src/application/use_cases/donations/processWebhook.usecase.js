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
  * @returns {Promise<{ status: string, donationId?: string }>}
   */
  async execute(gatewayName, body, headers, parsedBody) {
    const gateway = this.paymentGatewayFactory.get(gatewayName.toUpperCase());
    const parsed = await gateway.parseWebhook(body, headers, parsedBody);

    // payment:created only opens the checkout session; it is not a payment result.
    if (parsed.status === 'PENDING') {
      return { status: 'PENDING_ACKNOWLEDGED' };
    }

    const reference = parsed.orderId || parsed.gatewayRef;
    let donation = reference
      ? await this.donationRepository.findByIdOrGatewayRef(reference)
      : null;
    if (!donation && parsed.orderId && parsed.gatewayRef) {
      donation = await this.donationRepository.findByIdOrGatewayRef(parsed.gatewayRef);
    }
    if (!donation) throw new NotFoundError('Donation');

    if (parsed.status === 'COMPLETED') {
      await this.donationRepository.update(donation.id, {
        status: 'COMPLETED',
        gatewayMeta: { ...(donation.gatewayMeta || {}), ...parsed.meta },
      });

      return { status: 'COMPLETED', donationId: donation.id };
    }

    await this.donationRepository.update(donation.id, {
      status: 'FAILED',
      gatewayMeta: { ...(donation.gatewayMeta || {}), ...parsed.meta },
    });

    return { status: 'FAILED', donationId: donation.id };
  }
}

module.exports = { ProcessWebhookUseCase };
