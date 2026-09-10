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
    const parsed = parsedBody?.eventType ? parsedBody : await gateway.parseWebhook(body, headers);
    const eventType = parsed.eventType;

    if (!eventType) return { status: 'IGNORED_UNHANDLED_EVENT' };
    if (
      parsed.eventId &&
      this.donationRepository.findBySafepayEventId &&
      (await this.donationRepository.findBySafepayEventId(parsed.eventId))
    ) {
      return { status: 'DUPLICATE_EVENT', eventId: parsed.eventId };
    }

    if (
      eventType === 'refund:created' ||
      eventType === 'error:occurred' ||
      parsed.status === null
    ) {
      return { status: 'LOGGED_ONLY', eventType };
    }

    const reference = parsed.orderId || parsed.gatewayRef;
    let donation = reference
      ? await this.donationRepository.findByOrderIdOrGatewayRef(reference)
      : null;
    if (!donation && parsed.orderId && parsed.gatewayRef) {
      donation = await this.donationRepository.findByIdOrGatewayRef(parsed.gatewayRef);
    }
    if (!donation) throw new NotFoundError('Donation');

    const updated = await this.donationRepository.update(donation.id, {
      status: parsed.status,
      safepayEventId: parsed.eventId || undefined,
      safepayPaymentId: parsed.paymentId || parsed.transactionId || undefined,
      gatewayMeta: { ...(donation.gatewayMeta || {}), ...parsed.meta },
    });

    if (updated.status === 'COMPLETED') {
      try {
        const { donationReceiptQueue } = require('../../../infrastructure/workers/queue');
        void donationReceiptQueue
          .add('generate-and-email', { donationId: donation.id })
          .catch((error) => {
            console.error('[Donation receipt queue error]:', error.message);
          });
      } catch (error) {
        console.error('[Donation receipt queue error]:', error.message);
      }
    }

    return { status: updated.status, donationId: donation.id, eventId: parsed.eventId };
  }
}

module.exports = { ProcessWebhookUseCase };
