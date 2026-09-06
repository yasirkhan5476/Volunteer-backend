'use strict';

const { comparePassword, signAccessToken, signRefreshToken } = require('../../../core/security');
const { UnauthorizedError } = require('../../../core/exceptions');
const { UserEntity } = require('../../../domain/entities/user');

/**
 * Login Use Case
 *
 * Validates credentials and issues access + refresh tokens.
 */
class LoginUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  /**
   * @param {{ email: string, password: string }} dto
   * @returns {Promise<{ user: UserEntity, accessToken: string, refreshToken: string }>}
   */
  async execute(dto) {
    const record = await this.userRepository.findByEmail(dto.email.toLowerCase());

    if (!record) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!record.isActive) {
      throw new UnauthorizedError('Your account has been deactivated');
    }

    const isMatch = await comparePassword(dto.password, record.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokenPayload = { sub: record.id, role: record.role, isVerified: record.isVerified };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await this.userRepository.update(record.id, { lastLoginAt: new Date() });

    return {
      user: new UserEntity(record),
      accessToken,
      refreshToken,
    };
  }
}

module.exports = { LoginUseCase };
