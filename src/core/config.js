'use strict';

require('dotenv').config();

/**
 * Centralised, validated configuration object.
 * Throws at startup if any required variable is missing.
 */

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

function normalizeDatabaseUrl(value) {
  return value.trim().replace(/^"|"$/g, '');
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  apiPrefix: optional('API_PREFIX', '/api/v1'),
  isDev: optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',

  db: {
    url: normalizeDatabaseUrl(required('DATABASE_URL')),
  },

  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
    password: optional('REDIS_PASSWORD'),
    maxMemoryPolicy: optional('REDIS_MAXMEMORY_POLICY', 'noeviction'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
    passwordResetExpiresIn: optional('JWT_PASSWORD_RESET_EXPIRES_IN', '1h'),
  },

  app: {
    frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),
  },

  bcrypt: {
    saltRounds: parseInt(optional('BCRYPT_SALT_ROUNDS', '12'), 10),
  },

  smtp: {
    host: optional('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    secure: optional('SMTP_SECURE', 'false') === 'true',
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    from: optional('EMAIL_FROM', 'Volunteer Platform <no-reply@volunteerplatform.pk>'),
  },

  s3: {
    accessKeyId: optional('AWS_ACCESS_KEY_ID'),
    secretAccessKey: optional('AWS_SECRET_ACCESS_KEY'),
    region: optional('AWS_REGION', 'ap-south-1'),
    bucket: optional('AWS_S3_BUCKET', 'volunteer-platform-assets'),
    endpoint: optional('S3_ENDPOINT'), // For MinIO
  },

  payments: {
    safePay: {
      publicKey: optional('SAFE_PAY_PUBLIC_KEY') || optional('SAFEPAY_PUBLIC_KEY') || optional('SAFE_PAY_CLIENT') || optional('SAFEPAY_CLIENT'),
      apiKey: optional('SAFE_PAY_API_KEY') || optional('SAFEPAY_API_KEY'),
      merchantSecret: optional('SAFE_PAY_MERCHANT_SECRET') || optional('SAFEPAY_MERCHANT_SECRET'),
      secret: optional('SAFE_PAY_SECRET') || optional('SAFEPAY_SECRET') || optional('SAFE_PAY_API_KEY') || optional('SAFEPAY_API_KEY'),
      baseUrl: optional('SAFE_PAY_BASE_URL') || optional('SAFEPAY_BASE_URL', 'https://sandbox.api.getsafepay.com'),
      checkoutPath: optional('SAFE_PAY_CHECKOUT_PATH', '/order/v1/init'),
      webhookSecret: optional('SAFE_PAY_WEBHOOK_SECRET') || optional('SAFEPAY_WEBHOOK_SECRET') || optional('SAFE_PAY_SECRET') || optional('SAFEPAY_SECRET'),
      webhookUrl: optional('SAFE_PAY_WEBHOOK_URL') || optional('SAFEPAY_WEBHOOK_URL'),
    },
  },

  geofence: {
    defaultRadiusMeters: parseInt(optional('DEFAULT_GEOFENCE_RADIUS_METERS', '200'), 10),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '1000'), 10),
  },

  passport: {
    privateKeyPath: optional('PASSPORT_PRIVATE_KEY_PATH', './keys/passport_private.pem'),
    publicKeyPath: optional('PASSPORT_PUBLIC_KEY_PATH', './keys/passport_public.pem'),
  },
};

module.exports = config;
