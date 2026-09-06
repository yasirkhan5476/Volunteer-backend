'use strict';

const { ForbiddenError } = require('../../../core/exceptions');

/**
 * RBAC Authorization Middleware Factory
 *
 * Usage: authorize('ADMIN', 'ORGANIZER', 'SUPER_ADMIN')
 *
 * @param {...string} roles - Allowed roles
 * @returns {import('express').RequestHandler}
 */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ForbiddenError());
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access restricted. Required role(s): ${roles.join(', ')}`
        )
      );
    }

    next();
  };
}

module.exports = { authorize };
