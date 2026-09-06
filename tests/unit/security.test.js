'use strict';

// Provide minimal env for config
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-algorithm-yes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-also-long-enough-yes-it-is';
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'pass';

const {
  hashPassword,
  comparePassword,
  signAccessToken,
  verifyAccessToken,
} = require('../../src/core/security');


describe('Security Helpers', () => {
  describe('hashPassword / comparePassword', () => {
    test('hashes a password and compares successfully', async () => {
      const plain = 'MySecret@123';
      const hash = await hashPassword(plain);
      expect(hash).not.toBe(plain);
      expect(hash.startsWith('$2')).toBe(true);
      const match = await comparePassword(plain, hash);
      expect(match).toBe(true);
    });

    test('returns false for wrong password', async () => {
      const hash = await hashPassword('Correct@123');
      const match = await comparePassword('Wrong@123', hash);
      expect(match).toBe(false);
    });
  });

  describe('signAccessToken / verifyAccessToken', () => {
    test('signs and verifies a token', () => {
      const payload = { sub: 'user-123', role: 'VOLUNTEER' };
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.role).toBe('VOLUNTEER');
    });

    test('throws on tampered token', () => {
      const token = signAccessToken({ sub: 'user-123', role: 'VOLUNTEER' });
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });
});
