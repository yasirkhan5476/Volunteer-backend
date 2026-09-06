'use strict';

const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } = require('../../../application/dtos/auth.dto');
const { RegisterUseCase } = require('../../../application/use_cases/users/register.usecase');
const { LoginUseCase } = require('../../../application/use_cases/users/login.usecase');
const { ForgotPasswordUseCase } = require('../../../application/use_cases/users/forgotPassword.usecase');
const { ResetPasswordUseCase } = require('../../../application/use_cases/users/resetPassword.usecase');
const { GetProfileUseCase } = require('../../../application/use_cases/users/getProfile.usecase');
const { UpdateProfileUseCase } = require('../../../application/use_cases/users/updateProfile.usecase');
const { UserRepository } = require('../../../infrastructure/db/repositories/user.repository');
const { UnauthorizedError } = require('../../../core/exceptions');
const { verifyRefreshToken, signAccessToken, signRefreshToken } = require('../../../core/security');
const { UserEntity } = require('../../../domain/entities/user');

const router = Router();

// ─── Dependency Injection ────────────────────────────────────
const userRepository = new UserRepository();
const registerUseCase = new RegisterUseCase({ userRepository });
const loginUseCase = new LoginUseCase({ userRepository });
const forgotPasswordUseCase = new ForgotPasswordUseCase({ userRepository });
const resetPasswordUseCase = new ResetPasswordUseCase({ userRepository });
const getProfileUseCase = new GetProfileUseCase({ userRepository });
const updateProfileUseCase = new UpdateProfileUseCase({ userRepository });

/**
 * POST /auth/register
 */
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const user = await registerUseCase.execute(req.body);
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: user.toPublic(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await loginUseCase.execute(req.body);
    res.status(200).json({
      success: true,
      data: {
        user: user.toPublic(),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/refresh  — Rotate access + refresh tokens
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const record = await userRepository.findById(decoded.sub);
    if (!record || !record.isActive) {
      throw new UnauthorizedError('User not found or deactivated');
    }

    const tokenPayload = { sub: record.id, role: record.role };
    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/forgot-password
 */
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const result = await forgotPasswordUseCase.execute(req.body);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/reset-password
 */
router.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const result = await resetPasswordUseCase.execute(req.body);
    res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/stats  — Public: volunteer & organizer counts
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const counts = await userRepository.getRoleCounts();
    res.status(200).json({
      success: true,
      data: {
        volunteers: counts.volunteers,
        organizers: counts.organizers,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/me  — Current authenticated user profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { user, profile } = await getProfileUseCase.execute(req.user.id);
    res.status(200).json({
      success: true,
      data: { ...user.toPublic(), volunteerProfile: profile },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /auth/profile
 */
router.patch('/profile', authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await updateProfileUseCase.execute(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: user.toPublic(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/users  — List all users (ADMIN / ORGANIZER only)
 */
router.get('/users', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'ORGANIZER'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, role, isActive } = req.query;
    const users = await userRepository.findAll({
      page: Number(page),
      limit: Number(limit),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    });

    res.status(200).json({
      success: true,
      data: users.map((u) => new UserEntity(u).toPublic()),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
