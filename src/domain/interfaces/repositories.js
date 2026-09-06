'use strict';

/**
 * Abstract Base Repository interface.
 *
 * All infrastructure repository implementations must extend this class
 * and provide concrete implementations of these methods.
 */
class BaseRepository {
  /**
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async findById(id) {
    throw new Error('findById() must be implemented by subclass');
  }

  /**
   * @param {object} filters
   * @returns {Promise<object[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async findAll(filters = {}) {
    throw new Error('findAll() must be implemented by subclass');
  }

  /**
   * @param {object} data
   * @returns {Promise<object>}
   */
  // eslint-disable-next-line no-unused-vars
  async create(data) {
    throw new Error('create() must be implemented by subclass');
  }

  /**
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  // eslint-disable-next-line no-unused-vars
  async update(id, data) {
    throw new Error('update() must be implemented by subclass');
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async delete(id) {
    throw new Error('delete() must be implemented by subclass');
  }
}

module.exports = { BaseRepository };
