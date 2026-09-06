'use strict';

/**
 * Abstract Base Payment Gateway interface.
 *
 * All payment gateway adapters (SafePay, JazzCash, EasyPaisa)
 * must extend this class.
 */
class BasePaymentGateway {
  constructor(config) {
    if (new.target === BasePaymentGateway) {
      throw new Error('BasePaymentGateway cannot be instantiated directly');
    }
    this.config = config;
  }

  /**
   * Initiate a payment session / transaction.
   *
   * @param {{ amount: number, currency: string, orderId: string, description: string, callbackUrl: string }} params
   * @returns {Promise<{ gatewayRef: string, redirectUrl?: string, meta: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async initiatePayment(params) {
    throw new Error('initiatePayment() must be implemented by subclass');
  }

  /**
   * Verify a payment using gateway reference.
   *
   * @param {string} gatewayRef
   * @returns {Promise<{ status: 'COMPLETED'|'FAILED'|'PENDING', meta: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async verifyPayment(gatewayRef) {
    throw new Error('verifyPayment() must be implemented by subclass');
  }

  /**
   * Validate and parse an inbound webhook payload.
   *
   * @param {object} body - Raw webhook request body
   * @param {object} headers - Webhook request headers
   * @returns {Promise<{ gatewayRef: string, status: string, meta: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async parseWebhook(body, headers) {
    throw new Error('parseWebhook() must be implemented by subclass');
  }
}

module.exports = { BasePaymentGateway };
