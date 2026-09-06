'use strict';

const { UnauthorizedError } = require('../../../core/exceptions');
const { verifyAccessToken } = require('../../../core/security');

/**
 * JWT Authentication Middleware
 *
 * Extracts Bearer token from Authorization header,
 * verifies it, and attaches the decoded payload to req.user.
 */
async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token has expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    next(err);
  }
}

module.exports = { authenticate };
