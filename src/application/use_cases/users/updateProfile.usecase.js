'use strict';

const { NotFoundError } = require('../../../core/exceptions');
const { UserEntity } = require('../../../domain/entities/user');

/**
 * Update Profile Use Case
 */
class UpdateProfileUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  /**
   * @param {string} userId
   * @param {{ firstName?: string, lastName?: string, phone?: string, bio?: string, skills?: string[] }} dto
   * @returns {Promise<UserEntity>}
   */
  async execute(userId, dto) {
    const existing = await this.userRepository.findById(userId);
    if (!existing) throw new NotFoundError('User');

    const { bio, skills, ...userFields } = dto;

    // Update core user fields if provided
    if (Object.keys(userFields).length > 0) {
      await this.userRepository.update(userId, userFields);
    }

    // Update volunteer profile if bio/skills provided
    if (bio !== undefined || skills !== undefined) {
      await this.userRepository.upsertVolunteerProfile(userId, { bio, skills });
    }

    const updated = await this.userRepository.findByIdWithProfile(userId);
    return new UserEntity(updated);
  }
}

module.exports = { UpdateProfileUseCase };
