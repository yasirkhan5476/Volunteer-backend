'use strict';

const { ValidationError } = require('../../../core/exceptions');

/**
 * Zod Schema Validation Middleware Factory
 *
 * Validates req.body, req.params, and req.query against a Zod schema.
 * Schema should be a z.object({ body?, params?, query? }) shape.
 *
 * Usage: validate(registerSchema)
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(new ValidationError('Validation failed', errors));
    }

    // Merge parsed (coerced) values back onto request
    if (result.data.body) req.body = result.data.body;
    if (result.data.params) req.params = result.data.params;
    if (result.data.query) req.query = result.data.query;

    next();
  };
}

module.exports = { validate };
