'use strict';

const { NotFoundError } = require('../../../core/exceptions');
const { verifyPassportSignature, buildPayload } = require('../../../domain/services/passport.cryptography');
const { PassportEntity } = require('../../../domain/entities/passport');

/**
 * Verify Passport Use Case
 *
 * Re-builds the canonical payload and verifies the ECDSA signature
 * against the stored public key.
 */
class VerifyPassportUseCase {
  constructor({ passportRepository, userRepository }) {
    this.passportRepository = passportRepository;
    this.userRepository = userRepository;
  }

  /**
   * @param {string} passportId
   * @returns {Promise<{ passport: PassportEntity, isValid: boolean, user: object }>}
   */
  async execute(passportId) {
    const passport = await this.passportRepository.findById(passportId);
    if (!passport) throw new NotFoundError('Passport');

    const user = await this.userRepository.findByIdWithProfile(passport.userId);
    if (!user) throw new NotFoundError('User');

    // Rebuild canonical payload
    const payload = buildPayload({
      userId: passport.userId,
      fullName: `${user.firstName} ${user.lastName}`,
      totalHours: user.volunteerProfile?.totalHours || 0,
      issuedAt: passport.issuedAt.toISOString(),
      expiresAt: passport.expiresAt.toISOString(),
    });

    const isValid =
      verifyPassportSignature(payload, passport.signature, passport.publicKey) &&
      new PassportEntity(passport).isActive();

    return {
      passport: new PassportEntity(passport),
      isValid,
      user: {
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
    };
  }
}

module.exports = { VerifyPassportUseCase };
