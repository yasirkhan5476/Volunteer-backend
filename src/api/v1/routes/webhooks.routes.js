'use strict';

const { Router } = require('express');
const { ProcessWebhookUseCase } = require('../../../application/use_cases/donations/processWebhook.usecase');
const { DonationRepository } = require('../../../infrastructure/db/repositories/donation.repository');
const { paymentGatewayFactory } = require('../../../infrastructure/payments/base');

const router = Router();

const processWebhookUseCase = new ProcessWebhookUseCase({
  donationRepository: new DonationRepository(),
  paymentGatewayFactory,
});

/**
 * POST /webhooks/safepay
 */
router.post('/safepay', async (req, res) => {
  try {
    const result = await processWebhookUseCase.execute(
      'SAFE_PAY',
      req.rawBody || req.body,
      req.headers,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result,
    });
  } catch (err) {
    // Log the error for internal debugging
    console.error('⚠️ [Safepay Webhook Warning]:', err.message);

    // Always respond with HTTP 200 so Safepay registers successful delivery
    return res.status(200).json({
      success: false,
      message: 'Webhook received but processing bypassed',
      error: err.message,
    });
  }
});

module.exports = router;