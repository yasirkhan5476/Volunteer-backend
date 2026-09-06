'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');

// ─── Password Hashing ────────────────────────────────────────

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
}

/**
 * Compare a plain-text password with a stored hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── JWT ─────────────────────────────────────────────────────

/**
 * Sign an access token.
 * @param {object} payload
 * @returns {string} signed JWT
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Sign a refresh token.
 * @param {object} payload
 * @returns {string} signed JWT
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Sign a short-lived password reset token.
 * @param {object} payload
 * @returns {string} signed JWT
 */
function signPasswordResetToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.passwordResetExpiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Verify an access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
}

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] });
}

/**
 * Verify a password reset token.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyPasswordResetToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
}

module.exports = {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  signPasswordResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyPasswordResetToken,
};
