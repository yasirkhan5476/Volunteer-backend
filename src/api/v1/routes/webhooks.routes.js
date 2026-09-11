'use strict';

const { Router } = require('express');
const {
  ProcessWebhookUseCase,
} = require('../../../application/use_cases/donations/processWebhook.usecase');
const {
  DonationRepository,
} = require('../../../infrastructure/db/repositories/donation.repository');
const { paymentGatewayFactory } = require('../../../infrastructure/payments/base');

const router = Router();

const processWebhookUseCase = new ProcessWebhookUseCase({
  donationRepository: new DonationRepository(),
  paymentGatewayFactory,
});

async function processSafepayWebhook(req, res) {
  let verifiedEvent;
  try {
    const gateway = paymentGatewayFactory.get('SAFE_PAY');
    verifiedEvent = await gateway.parseWebhook(req.rawBody || req.body, req.headers);
  } catch (err) {
    const status = err.statusCode || err.status || 401;
    return res.status(status).json({ success: false, message: err.message });
  }

  try {
    const result = await processWebhookUseCase.execute(
      'SAFE_PAY',
      req.rawBody || req.body,
      req.headers,
      verifiedEvent
    );
    console.info('[Safepay webhook processed]', result);
    return res.status(200).json({ status: 'success', result });
  } catch (err) {
    console.error('[Safepay webhook error]:', err);
    return res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
    });
  }
}

// One endpoint receives both v1 colon and v2 dot events.
router.post('/safepay', processSafepayWebhook);

module.exports = router;
