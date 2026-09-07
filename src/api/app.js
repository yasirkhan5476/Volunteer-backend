'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('node:path');

const config = require('../core/config');
const { errorHandler } = require('./v1/middlewares/errorHandler');

// ─── Route Imports ───────────────────────────────────────────
const authRoutes = require('./v1/routes/auth.routes');
const eventRoutes = require('./v1/routes/events.routes');
const attendanceRoutes = require('./v1/routes/attendance.routes');
const donationRoutes = require('./v1/routes/donations.routes');
const webhookRoutes = require('./v1/routes/webhooks.routes');
const passportRoutes = require('./v1/routes/passport.routes');
const adminRoutes = require('./v1/routes/admin');

const app = express();

// ─── Trust Proxy for Vercel ──────────────────────────────────
app.set('trust proxy', 1);

// ─── Serve Local Static Uploads ──────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// ─── Security & CORS ─────────────────────────────────────────
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  process.env.FRONTEND_URL?.trim(),
].filter(Boolean);

const isAllowedOrigin = (requestOrigin) => {
  if (!requestOrigin) return true;
  if (allowedOrigins.includes(requestOrigin)) return true;
  // Allow all Vercel frontend deployments dynamically
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(requestOrigin);
};

const corsOptions = {
  origin: config.isDev
    ? true
    : (requestOrigin, callback) => {
        if (isAllowedOrigin(requestOrigin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS'));
      },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-sfpy-signature',
    'x-sfpy-timestamp',
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

// Mount CORS first to guarantee headers on all requests and preflights
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─── Rate Limiting ───────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.isProd ? Math.max(config.rateLimit.max, 1000) : config.rateLimit.max,
    skip: (req) =>
      req.method === 'OPTIONS' ||
      req.path === `${config.apiPrefix}/health`,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  })
);

// ─── Body Parsing & Raw Body Capture for Webhooks ───────────
app.use(compression());
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buffer) => {
      if (buffer && buffer.length) {
        req.rawBody = buffer.toString('utf8');
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Logging ─────────────────────────────────────────────────
app.use(morgan(config.isDev ? 'dev' : 'combined'));

// ─── Health Check ────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Volunteer Backend API is running successfully!',
    health: `${config.apiPrefix}/health`,
  });
});

app.get(`${config.apiPrefix}/health`, (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ──────────────────────────────────────────────
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/events`, eventRoutes);
app.use(`${config.apiPrefix}/attendance`, attendanceRoutes);
app.use(`${config.apiPrefix}/donations`, donationRoutes);
app.use(`${config.apiPrefix}/webhooks`, webhookRoutes);
app.use(`${config.apiPrefix}/passport`, passportRoutes);
app.use(`${config.apiPrefix}/admin`, adminRoutes);

// ─── 404 Handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'Route not found',
  });
});

// ─── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

module.exports = app;