'use strict';

const { z } = require('zod');

/** POST /auth/register */
const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    email: z.string().email(),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    phone: z.string().regex(/^\+92[0-9]{10}$/, 'Must be a valid Pakistani number (+92XXXXXXXXXX)').optional(),
    role: z.enum(['VOLUNTEER', 'ORGANIZER_PENDING', 'DONOR']).default('VOLUNTEER'),
  }),
});

/** POST /auth/login */
const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

/** POST /auth/forgot-password */
const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

/** POST /auth/reset-password */
const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
  }),
});

/** POST /auth/refresh */
const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

/** PATCH /users/profile */
const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: z.string().regex(/^\+92[0-9]{10}$/).optional(),
    bio: z.string().max(500).optional(),
    skills: z.array(z.string()).max(20).optional(),
  }),
});

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshSchema, updateProfileSchema };
