'use strict';

const { hashPassword } = require('../../../core/security');
const { ConflictError } = require('../../../core/exceptions');
const { UserEntity } = require('../../../domain/entities/user');
const { emailQueue } = require('../../../infrastructure/workers/queue');

/**
 * Register Use Case
 *
 * Creates a new user account.
 * Throws ConflictError if email already exists.
 */
class RegisterUseCase {
  /**
   * @param {{ userRepository: import('../../../infrastructure/db/repositories/user.repository') }} deps
   */
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  /**
   * @param {{ firstName: string, lastName: string, email: string, password: string, phone?: string, role?: string }} dto
   * @returns {Promise<UserEntity>}
   */
  async execute(dto) {
    // Check for duplicate email
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      passwordHash,
      phone: dto.phone || null,
      role: dto.role === 'ORGANIZER_PENDING' ? 'ORGANIZER_PENDING' : dto.role || 'VOLUNTEER',
    });

    // Auto-create volunteer profile for VOLUNTEER role
    if (user.role === 'VOLUNTEER') {
      await this.userRepository.createVolunteerProfile(user.id);
    }

    // Account creation must not be reported as failed when the optional
    // welcome-email queue is unavailable. The user row is already committed.
    try {
      await emailQueue.add('send-welcome-email', {
        to: user.email,
        template: 'welcome',
        data: {
          firstName: user.firstName,
        },
      });
    } catch (error) {
      console.warn('[Register] Welcome email was not queued:', error.message);
    }

    return new UserEntity(user);
  }
}

module.exports = { RegisterUseCase };
