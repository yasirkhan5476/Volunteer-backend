'use strict';

const { hashPassword, verifyPasswordResetToken } = require('../../../core/security');
const { UnauthorizedError } = require('../../../core/exceptions');

class ResetPasswordUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ token, password }) {
    let decoded;
    try {
      decoded = verifyPasswordResetToken(token);
    } catch {
      throw new UnauthorizedError('This password reset link is invalid or expired');
    }

    if (decoded.purpose !== 'password-reset' || !decoded.sub) {
      throw new UnauthorizedError('This password reset link is invalid or expired');
    }

    const user = await this.userRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('This password reset link is invalid or expired');
    }

    await this.userRepository.update(user.id, {
      passwordHash: await hashPassword(password),
    });

    return { message: 'Password reset successfully. You can now sign in.' };
  }
}

module.exports = { ResetPasswordUseCase };
