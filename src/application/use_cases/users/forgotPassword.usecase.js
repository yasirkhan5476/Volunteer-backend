'use strict';

const crypto = require('node:crypto');
const { signPasswordResetToken } = require('../../../core/security');
const { emailQueue } = require('../../../infrastructure/workers/queue');
const config = require('../../../core/config');

/**
 * Request a password reset email.
 * Security behavior: never reveal whether a user exists.
 */
class ForgotPasswordUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute(dto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return {
        message: 'If an account exists for that email, a password reset link has been sent.',
      };
    }

    const token = signPasswordResetToken({
      sub: user.id,
      purpose: 'password-reset',
      jti: crypto.randomUUID(),
    });

    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await emailQueue.add('send-password-reset-email', {
      to: user.email,
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetUrl,
      },
    });

    return {
      message: 'If an account exists for that email, a password reset link has been sent.',
    };
  }
}

module.exports = { ForgotPasswordUseCase };
