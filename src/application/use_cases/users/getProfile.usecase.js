'use strict';

const { NotFoundError } = require('../../../core/exceptions');
const { UserEntity } = require('../../../domain/entities/user');

/**
 * Get Profile Use Case
 */
class GetProfileUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  /**
   * @param {string} userId
   * @returns {Promise<{ user: UserEntity, profile: object|null }>}
   */
  async execute(userId) {
    const record = await this.userRepository.findByIdWithProfile(userId);
    if (!record) throw new NotFoundError('User');

    return {
      user: new UserEntity(record),
      profile: record.volunteerProfile || null,
    };
  }
}

module.exports = { GetProfileUseCase };
