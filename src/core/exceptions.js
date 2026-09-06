'use strict';

/**
 * Base application error — all custom errors extend this.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} [code]
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes from programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 – Bad Request / Validation failure */
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors; // Array of field-level errors from Zod
  }
}

/** 401 – Unauthenticated */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 – Forbidden / Insufficient permissions */
class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 – Resource not found */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/** 409 – Conflict (duplicate resource) */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 – Unprocessable (business rule violation) */
class UnprocessableError extends AppError {
  constructor(message) {
    super(message, 422, 'UNPROCESSABLE');
  }
}

/** 429 – Too many requests */
class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  TooManyRequestsError,
};
