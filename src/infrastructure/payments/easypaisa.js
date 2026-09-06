'use strict';

const { BasePaymentGateway } = require('../../domain/interfaces/payment');
const crypto = require('node:crypto');

/**
 * EasyPaisa OTC/MA API Adapter
 * Docs: https://developer.easypaisa.com.pk
 */
class EasyPaisaGateway extends BasePaymentGateway {
  constructor(config) {
    super(config);
  }

  _buildHash(params) {
    const data = Object.values(params).join('');
    return crypto.createHash('sha256').update(this.config.hashKey + data).digest('hex');
  }

  async initiatePayment({ amount, orderId, description, callbackUrl }) {
    const params = {
      storeId: this.config.storeId,
      amount: String(amount),
      postBackURL: callbackUrl,
      orderRefNum: orderId,
      expiryDate: new Date(Date.now() + 3600000).toISOString().split('T')[0].replace(/-/g, ''),
      paymentMethod: 'MA_PAYMENT', // Mobile Account
      trdDateTime: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
    };

    // TODO: POST {baseUrl}/easypay/PaymentOrder
    console.info(`[EasyPaisa] Initiating payment for order ${orderId}: PKR ${amount}`);

    return {
      gatewayRef: `EP-${orderId}`,
      redirectUrl: `${this.config.baseUrl}/pay?ref=EP-${orderId}`,
      meta: { provider: 'EASYPAISA', params, description },
    };
  }

  async verifyPayment(gatewayRef) {
    // TODO: POST {baseUrl}/easypay/inquiryPaymentOrder
    console.info(`[EasyPaisa] Verifying: ${gatewayRef}`);
    return { status: 'PENDING', meta: { gatewayRef } };
  }

  async parseWebhook(body, _headers) {
    return {
      gatewayRef: body.orderRefNum || body.reference,
      status: body.status === 'PAID' ? 'COMPLETED' : 'FAILED',
      meta: body,
    };
  }
}

module.exports = { EasyPaisaGateway };
