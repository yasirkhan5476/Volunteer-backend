'use strict';

const { z } = require('zod');

/** POST /donations */
const initiateDonationSchema = z.object({
  body: z
    .object({
      eventId: z.string().uuid(),
      amount: z.number().positive().min(100, 'Minimum donation is 100'),
      currency: z.enum(['PKR', 'ZAR']).default('PKR'),
      gateway: z.literal('SAFE_PAY'),
      callbackUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
      customerMobile: z.string().optional(),
      customerEmail: z.string().email().optional(),
      bankCode: z.string().min(1).optional(),
      accountNumber: z.string().min(1).optional(),
      accountTitle: z.string().min(1).optional(),
      cnicNumber: z.string().min(1).optional(),
      otpRequired: z.enum(['yes', 'no']).default('no'),
      otp: z.string().min(1).optional(),
    })
    .superRefine((body, context) => {
      if (body.currency !== 'PKR') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currency'],
          message: 'This gateway requires PKR currency',
        });
      }
    }),
});

module.exports = { initiateDonationSchema };
