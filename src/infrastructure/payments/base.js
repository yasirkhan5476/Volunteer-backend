'use strict';

const { JazzCashGateway } = require('./jazzcash');
const { EasyPaisaGateway } = require('./easypaisa');
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
  * @param {'SAFE_PAY'|'JAZZCASH'|'EASYPAISA'} name
   * @returns {import('../../domain/interfaces/payment').BasePaymentGateway}
   */
  get(name) {
    if (!this._instances[name]) {
      switch (name) {
        case 'SAFE_PAY':
          this._instances[name] = new SafePayGateway(config.payments.safePay);
          break;
        case 'JAZZCASH':
          this._instances[name] = new JazzCashGateway(config.payments.jazzcash);
          break;
        case 'EASYPAISA':
          this._instances[name] = new EasyPaisaGateway(config.payments.easypaisa);
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
