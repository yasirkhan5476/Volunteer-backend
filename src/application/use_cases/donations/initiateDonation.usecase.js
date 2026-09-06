'use strict';

const { NotFoundError } = require('../../../core/exceptions');
const { DonationEntity } = require('../../../domain/entities/donation');

/**
 * Initiate Donation Use Case
 *
 * Creates a PENDING donation record and returns the gateway redirect URL.
 */
class InitiateDonationUseCase {
  constructor({ donationRepository, eventRepository, paymentGatewayFactory }) {
    this.donationRepository = donationRepository;
    this.eventRepository = eventRepository;
    this.paymentGatewayFactory = paymentGatewayFactory;
  }

  /**
   * @param {string} userId
   * @param {{ eventId: string, amount: number, currency: string, gateway: string, callbackUrl?: string }} dto
   * @returns {Promise<{ donation: DonationEntity, redirectUrl?: string, gatewayRef: string, paymentForm?: object }>}
   */
  async execute(userId, dto) {
    // 1. Validate event exists
    const event = await this.eventRepository.findById(dto.eventId);
    if (!event) throw new NotFoundError('Event');

    // 2. Create pending donation record
    const donation = await this.donationRepository.create({
      userId,
      eventId: dto.eventId,
      amount: dto.amount,
      currency: dto.currency || 'PKR',
      gateway: dto.gateway,
      status: 'PENDING',
    });

    // 3. Initiate payment via selected gateway
    const gateway = this.paymentGatewayFactory.get(dto.gateway);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const defaultCallbackUrl = `${frontendUrl}/donations/success?donationId=${donation.id}`;
    const defaultWebhookUrl =
      process.env.SAFE_PAY_WEBHOOK_URL ||
      `${(process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '')}${process.env.API_PREFIX || '/api/v1'}/webhooks/safepay`;

    let gatewayResult;
    try {
      gatewayResult = await gateway.initiatePayment({
        amount: dto.amount,
        currency: dto.currency || 'PKR',
        orderId: donation.id,
        description: `Donation to: ${event.title}`,
        callbackUrl: dto.callbackUrl || defaultCallbackUrl,
        customerMobile: dto.customerMobile,
        customerEmail: dto.customerEmail,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountTitle: dto.accountTitle,
        cnicNumber: dto.cnicNumber,
        otpRequired: dto.otpRequired,
        otp: dto.otp,
        customerIp: dto.customerIp,
        webhookUrl: defaultWebhookUrl,
      });
    } catch (error) {
      await this.donationRepository.update(donation.id, { status: 'FAILED', gatewayMeta: { error: error.message } });
      throw error;
    }

    // 4. Save gateway reference
    const updated = await this.donationRepository.update(donation.id, {
      gatewayRef: gatewayResult.gatewayRef,
      gatewayMeta: gatewayResult.meta,
    });

    return {
      donation: new DonationEntity(updated),
      redirectUrl: gatewayResult.redirectUrl,
      gatewayRef: gatewayResult.gatewayRef,
      paymentForm: gatewayResult.meta?.formData,
    };
  }
}

module.exports = { InitiateDonationUseCase };
