'use strict';

const request = require('supertest');

// Mock Prisma and Redis before app import
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    volunteerProfile: {
      create: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
  }));
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    upsertJobScheduler: jest.fn(),
    add: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-algorithm-yes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-also-long-enough-yes';
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'pass';

const app = require('../../src/api/app');
const { PrismaClient } = require('@prisma/client');
const { emailQueue } = require('../../src/infrastructure/workers/queue');
const mockDb = new PrismaClient();

describe('Auth Routes — Integration', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /api/v1/auth/register', () => {
    test('201 — creates a new volunteer account', async () => {
      mockDb.user.findUnique.mockResolvedValueOnce(null); // no duplicate
      mockDb.user.create.mockResolvedValueOnce({
        id: 'uuid-001',
        email: 'ali@test.com',
        firstName: 'Ali',
        lastName: 'Hassan',
        role: 'VOLUNTEER',
        isVerified: false,
        isActive: true,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockDb.volunteerProfile.create.mockResolvedValueOnce({});

      const res = await request(app).post('/api/v1/auth/register').send({
        firstName: 'Ali',
        lastName: 'Hassan',
        email: 'ali@test.com',
        password: 'Secret@123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('ali@test.com');
    });

    test('409 — duplicate email', async () => {
      mockDb.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

      const res = await request(app).post('/api/v1/auth/register').send({
        firstName: 'Ali',
        lastName: 'Hassan',
        email: 'ali@test.com',
        password: 'Secret@123',
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    test('400 — weak password fails validation', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        firstName: 'Ali',
        lastName: 'Hassan',
        email: 'ali@test.com',
        password: 'weak',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    test('200 — accepts email and queues a reset email when user exists', async () => {
      mockDb.user.findUnique.mockResolvedValueOnce({
        id: 'uuid-002',
        email: 'ali@test.com',
        firstName: 'Ali',
        lastName: 'Hassan',
        role: 'VOLUNTEER',
        isActive: true,
      });

      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'ali@test.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-password-reset-email',
        expect.objectContaining({
          to: 'ali@test.com',
          template: 'password-reset',
        })
      );
    });

    test('200 — generic success even when email does not exist', async () => {
      mockDb.user.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'missing@test.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/If an account exists/i);
    });
  });

  describe('GET /api/v1/auth/stats', () => {
    test('200 — returns live volunteer and organizer counts', async () => {
      mockDb.user.groupBy.mockResolvedValueOnce([
        { role: 'VOLUNTEER', _count: { role: 1240 } },
        { role: 'ORGANIZER', _count: { role: 74 } },
        { role: 'ADMIN', _count: { role: 8 } },
      ]);

      const res = await request(app).get('/api/v1/auth/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.volunteers).toBe(1240);
      expect(res.body.data.organizers).toBe(74);
    });
  });

  describe('GET /api/v1/health', () => {
    test('200 — returns health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });
});
