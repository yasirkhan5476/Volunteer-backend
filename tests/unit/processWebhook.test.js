'use strict';

const { ProcessWebhookUseCase } = require('../../src/application/use_cases/donations/processWebhook.usecase');

describe('ProcessWebhookUseCase', () => {
  const parsedBody = {};
  let donationRepository;
  let paymentGateway;
  let useCase;

  beforeEach(() => {
    donationRepository = {
      findByGatewayRef: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    paymentGateway = {
      parseWebhook: jest.fn(),
    };
    useCase = new ProcessWebhookUseCase({
      donationRepository,
      paymentGatewayFactory: { get: () => paymentGateway },
    });
  });

  test('ignores payment:created without looking up or updating a donation', async () => {
    paymentGateway.parseWebhook.mockResolvedValue({
      eventType: 'payment:created',
      status: 'PENDING',
    });

    await expect(useCase.execute('SAFE_PAY', '{}', {}, parsedBody)).resolves.toEqual({
      success: true,
      status: 'IGNORED_INITIATION_EVENT',
    });

    expect(donationRepository.findByGatewayRef).not.toHaveBeenCalled();
    expect(donationRepository.update).not.toHaveBeenCalled();
  });

  test('updates a donation when payment.succeeded is parsed as COMPLETED', async () => {
    paymentGateway.parseWebhook.mockResolvedValue({
      eventType: 'payment.succeeded',
      gatewayRef: 'tracker-123',
      status: 'COMPLETED',
      meta: { event: 'payment.succeeded' },
    });
    donationRepository.findByGatewayRef.mockResolvedValue({
      id: 'donation-123',
      gatewayMeta: {},
    });

    await expect(useCase.execute('SAFE_PAY', '{}', {}, parsedBody)).resolves.toEqual({
      success: true,
      donationId: 'donation-123',
      status: 'COMPLETED',
    });

    expect(donationRepository.update).toHaveBeenCalledWith('donation-123', {
      status: 'COMPLETED',
      gatewayMeta: { event: 'payment.succeeded' },
    });
  });

  test('does not rewrite a donation for a pending webhook', async () => {
    paymentGateway.parseWebhook.mockResolvedValue({
      eventType: 'payment:updated',
      gatewayRef: 'tracker-123',
      status: 'PENDING',
      meta: {},
    });
    donationRepository.findByGatewayRef.mockResolvedValue({
      id: 'donation-123',
      gatewayMeta: {},
    });

    await expect(useCase.execute('SAFE_PAY', '{}', {}, parsedBody)).resolves.toEqual({
      success: true,
      donationId: 'donation-123',
      status: 'PENDING',
    });

    expect(donationRepository.update).not.toHaveBeenCalled();
  });
});