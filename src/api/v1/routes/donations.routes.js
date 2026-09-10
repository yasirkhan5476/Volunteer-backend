'use strict';

const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { initiateDonationSchema } = require('../../../application/dtos/donation.dto');
const {
  InitiateDonationUseCase,
} = require('../../../application/use_cases/donations/initiateDonation.usecase');
const {
  VerifyDonationUseCase,
} = require('../../../application/use_cases/donations/verifyDonation.usecase');
const {
  DonationRepository,
} = require('../../../infrastructure/db/repositories/donation.repository');
const { EventRepository } = require('../../../infrastructure/db/repositories/event.repository');
const { paymentGatewayFactory } = require('../../../infrastructure/payments/base');
const { rejectPendingOrganizer } = require('../middlewares/auth');
const { NotFoundError, ForbiddenError } = require('../../../core/exceptions');

const router = Router();

const donationRepository = new DonationRepository();
const eventRepository = new EventRepository();
const initiateDonationUseCase = new InitiateDonationUseCase({
  donationRepository,
  eventRepository,
  paymentGatewayFactory,
});
const verifyDonationUseCase = new VerifyDonationUseCase({
  donationRepository,
  paymentGatewayFactory,
});

/**
 * POST /donations  — Initiate a donation
 */
router.post(
  '/',
  authenticate,
  rejectPendingOrganizer,
  validate(initiateDonationSchema),
  async (req, res, next) => {
    try {
      const result = await initiateDonationUseCase.execute(req.user.id, {
        ...req.body,
        customerIp: req.ip,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /donations/my  — Current user's donations
 */
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const donations = await donationRepository.findAll({ userId: req.user.id });
    res.status(200).json({ success: true, data: donations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /donations/verify/:id - Verify by donation UUID, order ID, or Safepay tracker
 */
const verifyDonationStatus = async (req, res, next) => {
  try {
    const donation = await verifyDonationUseCase.execute(req.user, req.params.id);
    res.status(200).json({ success: true, data: donation });
  } catch (err) {
    next(err);
  }
};

router.get('/verify/:id', authenticate, verifyDonationStatus);
router.get('/:id/status', authenticate, verifyDonationStatus);

/**
 * GET /donations/:id  — Get single donation details (for status verification after checkout)
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    let donation = await donationRepository.findById(req.params.id);
    if (!donation) throw new NotFoundError('Donation');
    if (
      donation.userId !== req.user.id &&
      req.user.role !== 'SUPER_ADMIN' &&
      req.user.role !== 'ADMIN'
    ) {
      throw new ForbiddenError();
    }

    res.status(200).json({ success: true, data: donation });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
