'use strict';

const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { issuePassportSchema, verifyPassportSchema } = require('../../../application/dtos/passport.dto');
const { IssuePassportUseCase } = require('../../../application/use_cases/passport/issuePassport.usecase');
const { VerifyPassportUseCase } = require('../../../application/use_cases/passport/verifyPassport.usecase');
const { PassportRepository } = require('../../../infrastructure/db/repositories/passport.repository');
const { UserRepository } = require('../../../infrastructure/db/repositories/user.repository');

const router = Router();

const passportRepository = new PassportRepository();
const userRepository = new UserRepository();
const issuePassportUseCase = new IssuePassportUseCase({ userRepository, passportRepository });
const verifyPassportUseCase = new VerifyPassportUseCase({ passportRepository, userRepository });

/**
 * POST /passport/issue  — Issue a passport (VOLUNTEER self-issue or ADMIN for any user)
 */
router.post(
  '/issue',
  authenticate,
  authorize('VOLUNTEER', 'SUPER_ADMIN', 'ADMIN'),
  validate(issuePassportSchema),
  async (req, res, next) => {
    try {
      const passport = await issuePassportUseCase.execute(req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Passport issued. PDF generation is in progress.',
        data: passport,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /passport/verify/:passportId  — Verify a passport (public)
 */
router.get('/verify/:passportId', validate(verifyPassportSchema), async (req, res, next) => {
  try {
    const result = await verifyPassportUseCase.execute(req.params.passportId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /passport/my  — Get current user's passports
 */
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const passports = await passportRepository.findByUserId(req.user.id);
    res.status(200).json({ success: true, data: passports });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
