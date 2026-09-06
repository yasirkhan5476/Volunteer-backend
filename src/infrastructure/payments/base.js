'use strict';

const { SafePayGateway } = require('./safepay');
const config = require('../../core/config');

/**
 * Payment Gateway Factory
 *
 * Returns the appropriate gateway instance by name.
 * Gateways are lazy-instantiated and cached.
 */
class PaymentGatewayFactory {
  constructor() {
    this._instances = {};
  }

  /**
   * @param {'SAFE_PAY'} name
   * @returns {import('../../domain/interfaces/payment').BasePaymentGateway}
   */
  get(name) {
    if (!this._instances[name]) {
      switch (name) {
        case 'SAFE_PAY':
          this._instances[name] = new SafePayGateway(config.payments.safePay);
          break;
        default:
          throw new Error(`Unknown payment gateway: ${name}`);
      }
    }
    return this._instances[name];
  }
}

// Export singleton factory instance
module.exports = { paymentGatewayFactory: new PaymentGatewayFactory() };
