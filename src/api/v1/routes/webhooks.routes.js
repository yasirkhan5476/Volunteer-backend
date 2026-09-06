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
router.post('/safepay', async (req, res, next) => {
  try {
    const result = await processWebhookUseCase.execute('SAFE_PAY', req.body, req.headers);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /webhooks/jazzcash
 */
router.post('/jazzcash', async (req, res, next) => {
  try {
    const result = await processWebhookUseCase.execute('JAZZCASH', req.body, req.headers);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /webhooks/easypaisa
 */
router.post('/easypaisa', async (req, res, next) => {
  try {
    const result = await processWebhookUseCase.execute('EASYPAISA', req.body, req.headers);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
