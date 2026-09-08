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

async function processSafepayWebhook(req, res, endpoint) {
  try {
    const result = await processWebhookUseCase.execute(
      'SAFE_PAY',
      req.rawBody || req.body,
      req.headers,
      req.body
    );

    console.info(`[Safepay ${endpoint} webhook]`, result);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error(`[Safepay ${endpoint} webhook error]:`, err);

    return res.status(200).json({
      success: false,
      message: err.message,
    });
  }
}

// v1 receives PAYMENT:CREATED and acknowledges the pending checkout session.
router.post('/safepay/v1', (req, res) =>
  processSafepayWebhook(req, res, 'v1')
);

// v2 receives PAYMENT.SUCCEEDED/PAYMENT.FAILED and updates the donation.
router.post('/safepay/v2', (req, res) =>
  processSafepayWebhook(req, res, 'v2')
);

// Legacy endpoint retained for existing Safepay dashboard configurations.
router.post('/safepay', (req, res) =>
  processSafepayWebhook(req, res, 'legacy')
);

module.exports = router;