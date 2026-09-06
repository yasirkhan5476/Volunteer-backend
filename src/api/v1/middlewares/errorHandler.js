'use strict';

const config = require('../../../core/config');
const { AppError } = require('../../../core/exceptions');

/**
 * Global Error Handler Middleware
 *
 * Must be registered LAST in Express middleware chain.
 * Handles: AppError subclasses, Prisma errors, JWT errors, generic errors.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // ─── Operational (known) errors ──────────────────────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
      ...(config.isDev && { stack: err.stack }),
    });
  }

  // ─── Prisma unique constraint ────────────────────────────────
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      code: 'CONFLICT',
      message: `Duplicate value for field: ${err.meta?.target?.join(', ')}`,
    });
  }

  // ─── Prisma record not found ─────────────────────────────────
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Record not found',
    });
  }

  // ─── Unknown / programmer errors ─────────────────────────────
  console.error('[ErrorHandler] Unexpected error:', err);

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: config.isProd ? 'An unexpected error occurred' : err.message,
    ...(config.isDev && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
