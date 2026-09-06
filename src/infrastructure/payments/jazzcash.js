'use strict';

const { BasePaymentGateway } = require('../../domain/interfaces/payment');
const crypto = require('node:crypto');

/**
 * JazzCash MWALLET API Adapter
 * Docs: https://developer.jazzcash.com.pk
 */
class JazzCashGateway extends BasePaymentGateway {
  constructor(config) {
    super(config);
  }

  /**
   * Build HMAC-SHA256 integrity hash required by JazzCash.
   */
  _buildHash(params) {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => params[k])
      .join('&');
    return crypto
      .createHmac('sha256', this.config.integritySalt)
      .update(sorted)
      .digest('hex');
  }

  async initiatePayment({ amount, currency, orderId, description, callbackUrl }) {
    const txnDateTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const expiryDateTime = new Date(Date.now() + 3600000)
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);

    const params = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: this.config.merchantId,
      pp_Password: this.config.password,
      pp_TxnRefNo: `T${orderId.replace(/-/g, '').slice(0, 20)}`,
      pp_Amount: String(Math.round(amount * 100)), // JazzCash expects paisa
      pp_TxnCurrency: currency || 'PKR',
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: `bill-${orderId}`,
      pp_Description: description,
      pp_TxnExpiryDateTime: expiryDateTime,
      pp_ReturnURL: callbackUrl,
      pp_SecureHash: '',
    };

    params.pp_SecureHash = this._buildHash(params);

    // TODO: POST {baseUrl}/MerchantTransactionWeb/Services/DoMWalletTransaction
    console.info(`[JazzCash] Initiating MWALLET payment for order ${orderId}`);

    return {
      gatewayRef: params.pp_TxnRefNo,
      redirectUrl: null, // JazzCash is direct API call, no redirect
      meta: { provider: 'JAZZCASH', params },
    };
  }

  async verifyPayment(gatewayRef) {
    // TODO: POST {baseUrl}/MerchantTransactionWeb/Services/PaymentInquiry
    console.info(`[JazzCash] Verifying payment: ${gatewayRef}`);
    return { status: 'PENDING', meta: { gatewayRef } };
  }

  async parseWebhook(body, _headers) {
    return {
      gatewayRef: body.pp_TxnRefNo,
      status: body.pp_ResponseCode === '000' ? 'COMPLETED' : 'FAILED',
      meta: body,
    };
  }
}

module.exports = { JazzCashGateway };
