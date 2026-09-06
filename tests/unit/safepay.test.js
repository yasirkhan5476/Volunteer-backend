'use strict';

const { SafePayGateway } = require('../../src/infrastructure/payments/safepay');
const crypto = require('node:crypto');

describe('SafePayGateway', () => {
  const mockConfig = {
    publicKey: 'sec_test_client_key_123',
    apiKey: 'api_test_secret_key_123',
    baseUrl: 'https://sandbox.api.getsafepay.com',
    checkoutPath: '/order/v1/init',
    webhookSecret: 'test_webhook_secret_key',
  };

  let gateway;

  beforeEach(() => {
    gateway = new SafePayGateway(mockConfig);
    jest.restoreAllMocks();
  });

  describe('initiatePayment', () => {
    test('successfully initiates payment tracker and returns constructed checkout URL', async () => {
      const mockTrackerToken = 'track_test_tracker_12345';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            data: { token: mockTrackerToken },
            status: { errors: [], message: 'success' },
          })
        ),
      });

      const result = await gateway.initiatePayment({
        amount: 500,
        currency: 'PKR',
        orderId: 'order-uuid-123',
        description: 'Test Donation',
        callbackUrl: 'http://localhost:5173/donations/success',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://sandbox.api.getsafepay.com/order/v1/init',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-SFPY-API-KEY': 'api_test_secret_key_123',
          }),
          body: JSON.stringify({
            client: 'sec_test_client_key_123',
            amount: 500,
            currency: 'PKR',
            environment: 'sandbox',
          }),
        })
      );

      expect(result.gatewayRef).toBe(mockTrackerToken);
      expect(result.redirectUrl).toContain('https://sandbox.api.getsafepay.com/components');
      expect(result.redirectUrl).toContain(`token=${mockTrackerToken}`);
      expect(result.redirectUrl).toContain('orderId=order-uuid-123');
      expect(result.redirectUrl).toContain('redirectUrl=http%3A%2F%2Flocalhost%3A5173%2Fdonations%2Fsuccess');
    });

    test('throws AppError if Safepay returns error status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            data: null,
            status: { errors: ['Invalid amount'], message: 'fail' },
          })
        ),
      });

      await expect(
        gateway.initiatePayment({
          amount: 50,
          currency: 'PKR',
          orderId: 'order-uuid-123',
        })
      ).rejects.toThrow('Invalid amount');
    });
  });

  describe('parseWebhook', () => {
    test('correctly parses successful payment webhook with data.tracker and PAID state', async () => {
      const webhookBody = {
        event: 'payment.completed',
        data: {
          tracker: 'track_test_tracker_12345',
          order_id: 'order-uuid-123',
          state: 'PAID',
          amount: 500,
        },
      };

      const timestamp = String(Date.now());
      const rawPayload = `${timestamp}.${JSON.stringify(webhookBody)}`;
      const signature = crypto
        .createHmac('sha256', mockConfig.webhookSecret)
        .update(rawPayload)
        .digest('hex');

      const headers = {
        'x-sfpy-signature': signature,
        'x-sfpy-timestamp': timestamp,
      };

      const result = await gateway.parseWebhook(webhookBody, headers);

      expect(result.gatewayRef).toBe('track_test_tracker_12345');
      expect(result.orderId).toBe('order-uuid-123');
      expect(result.status).toBe('COMPLETED');
    });

    test('correctly parses TRACKER_ENDED state as COMPLETED', async () => {
      const webhookBody = {
        data: {
          token: 'track_tracker_abc',
          state: 'TRACKER_ENDED',
        },
      };

      const result = await gateway.parseWebhook(webhookBody);
      expect(result.gatewayRef).toBe('track_tracker_abc');
      expect(result.status).toBe('COMPLETED');
    });

    test('correctly parses failed payment as FAILED', async () => {
      const webhookBody = {
        event: 'payment.failed',
        data: {
          tracker: 'track_tracker_abc',
          state: 'FAILED',
        },
      };

      const result = await gateway.parseWebhook(webhookBody);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('verifyPayment', () => {
    test('queries reporter endpoint and returns COMPLETED for paid tracker', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: {
            state: 'TRACKER_ENDED',
          },
        }),
      });

      const result = await gateway.verifyPayment('track_123');
      expect(result.status).toBe('COMPLETED');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://sandbox.api.getsafepay.com/reporter/api/v1/payments/track_123',
        expect.anything()
      );
    });
  });
});
