'use strict';

const { ForbiddenError, UnauthorizedError } = require('../../../core/exceptions');
const { verifyAccessToken } = require('../../../core/security');
const { getDatabase } = require('../../../core/database');

async function authenticateToken(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyAccessToken(header.slice(7));
    req.user = { id: decoded.sub, role: decoded.role, isVerified: decoded.isVerified };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return next(new UnauthorizedError('Token has expired'));
    if (error.name === 'JsonWebTokenError') return next(new UnauthorizedError('Invalid token'));
    next(error);
  }
}

async function requireVerifiedOrganizer(req, _res, next) {
  try {
    const user = await getDatabase().user.findUnique({
      where: { id: req.user?.id },
      select: { role: true, isVerified: true },
    });

    if (!user || (!['ORGANIZER', 'SUPER_ADMIN', 'ADMIN'].includes(user.role)) || (user.role === 'ORGANIZER' && !user.isVerified)) {
      throw new ForbiddenError('Verified organizer access is required');
    }

    req.user.role = user.role;
    req.user.isVerified = user.isVerified;
    next();
  } catch (error) {
    next(error);
  }
}

function requireSuperAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return next(new ForbiddenError('Super admin access is required'));
  }
  next();
}

async function rejectPendingOrganizer(req, _res, next) {
  try {
    const user = await getDatabase().user.findUnique({ where: { id: req.user?.id }, select: { role: true } });
    if (user?.role === 'ORGANIZER_PENDING') {
      throw new ForbiddenError('Your organizer application must be approved before this action');
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticateToken, requireVerifiedOrganizer, requireSuperAdmin, rejectPendingOrganizer };