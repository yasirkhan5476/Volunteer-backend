'use strict';

const { z } = require('zod');

/** POST /passport/issue */
const issuePassportSchema = z.object({
  body: z.object({
    userId: z.string().uuid().optional(), // Admin can issue for another user
    validityMonths: z.number().int().min(1).max(24).default(12),
  }),
});

/** GET /passport/verify/:passportId */
const verifyPassportSchema = z.object({
  params: z.object({
    passportId: z.string().uuid(),
  }),
});

module.exports = { issuePassportSchema, verifyPassportSchema };
