'use strict';

const { NotFoundError, UnprocessableError } = require('../../../core/exceptions');
const { signPassport } = require('../../../domain/services/passport.cryptography');
const { PassportEntity } = require('../../../domain/entities/passport');
const { pdfQueue } = require('../../../infrastructure/workers/queue');

/**
 * Issue Passport Use Case
 *
 * 1. Checks the volunteer has logged at least 1 hour.
 * 2. Signs passport data with ECDSA private key.
 * 3. Persists the passport record.
 * 4. Queues a PDF generation job.
 */
class IssuePassportUseCase {
  constructor({ userRepository, passportRepository }) {
    this.userRepository = userRepository;
    this.passportRepository = passportRepository;
  }

  /**
   * @param {string} requestingUserId - Who is requesting the issue
   * @param {{ userId?: string, validityMonths?: number }} dto
   * @returns {Promise<PassportEntity>}
   */
  async execute(requestingUserId, dto) {
    // Allow admins to issue for another user, otherwise self-issue
    const targetUserId = dto.userId || requestingUserId;

    const user = await this.userRepository.findByIdWithProfile(targetUserId);
    if (!user) throw new NotFoundError('User');

    const profile = user.volunteerProfile;
    if (!profile || profile.totalHours < 1) {
      throw new UnprocessableError(
        'Volunteer must have logged at least 1 hour before a passport can be issued'
      );
    }

    // Build passport payload and sign
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (dto.validityMonths || 12));

    const { signature, publicKey } = signPassport({
      userId: targetUserId,
      fullName: `${user.firstName} ${user.lastName}`,
      totalHours: profile.totalHours,
      issuedAt,
      expiresAt: expiresAt.toISOString(),
    });

    // Persist
    const passport = await this.passportRepository.create({
      userId: targetUserId,
      signature,
      publicKey,
      status: 'ACTIVE',
      issuedAt: new Date(issuedAt),
      expiresAt,
    });

    // PDF generation is follow-up work and must not turn a committed passport
    // into a failed request when Redis/BullMQ is unavailable on Vercel.
    try {
      await pdfQueue.add('generate-passport-pdf', {
        passportId: passport.id,
        userId: targetUserId,
        fullName: `${user.firstName} ${user.lastName}`,
        totalHours: profile.totalHours,
        issuedAt,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('[Passport] PDF was not queued:', error.message);
    }

    return new PassportEntity(passport);
  }
}

module.exports = { IssuePassportUseCase };
