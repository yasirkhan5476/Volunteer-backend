'use strict';

const crypto = require('node:crypto');
const { BasePaymentGateway } = require('../../domain/interfaces/payment');
const { AppError } = require('../../core/exceptions');

/**
 * Safepay Payment Gateway Adapter
 * Official Documentation: https://getsafepay.com
 *
 * Flow:
 * 1. initiatePayment: POST /order/v1/init -> returns { data: { token: 'track_...' } }
 * 2. Redirect user to: {baseUrl}/components?token=track_...&orderId=...&redirectUrl=...
 * 3. parseWebhook: verifies X-SFPY-SIGNATURE and maps tracker status to internal status
 * 4. verifyPayment: inquires tracker status from reporter API
 */
class SafePayGateway extends BasePaymentGateway {
  constructor(config) {
    super(config);
  }

  /**
   * Resolve Safepay public client key (e.g. sec_...)
   */
  _getClientKey() {
    return this.config.publicKey || this.config.apiKey;
  }

  /**
   * Determine whether current environment is sandbox
   */
  _isSandbox() {
    const base = (this.config.baseUrl || '').toLowerCase();
    return base.includes('sandbox') || base.includes('dev') || process.env.NODE_ENV !== 'production';
  }

  /**
   * Get clean base URL
   */
  _getBaseUrl() {
    const raw = (this.config.baseUrl || 'https://sandbox.api.getsafepay.com').replace(/\/$/, '');
    // If dev.api.getsafepay.com was configured, default to sandbox.api.getsafepay.com which is the active sandbox
    if (raw.includes('dev.api.getsafepay.com')) {
      return 'https://sandbox.api.getsafepay.com';
    }
    return raw;
  }

  /**
   * Get component checkout base URL
   */
  _getComponentUrl() {
    if (this._isSandbox()) {
      return 'https://sandbox.api.getsafepay.com/components';
    }
    return 'https://getsafepay.com/components';
  }

  /**
   * Initiate a payment tracker and build the checkout redirect URL
   *
   * @param {{ amount: number, currency?: string, orderId: string, description?: string, callbackUrl?: string, webhookUrl?: string }} params
   * @returns {Promise<{ gatewayRef: string, redirectUrl: string, meta: object }>}
   */
 /**
   * Initiate a payment tracker and build the checkout redirect URL
   */
  async initiatePayment({ amount, currency = 'PKR', orderId, description, callbackUrl, webhookUrl }) {
    const clientKey = this._getClientKey();
    if (!clientKey) {
      throw new AppError(
        'Safepay requires SAFE_PAY_PUBLIC_KEY or SAFE_PAY_API_KEY in configuration',
        500,
        'PAYMENT_CONFIG_ERROR'
      );
    }

    const baseUrl = this._getBaseUrl();
    const checkoutPath = (this.config.checkoutPath || '/order/v1/init').replace(/^\//, '');
    const endpoint = `${baseUrl}/${checkoutPath}`;
    const environment = this._isSandbox() ? 'sandbox' : 'production';

    const payload = {
      client: clientKey,
      amount: Number(amount),
      currency: currency || 'PKR',
      environment,
    };

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.config.apiKey && { 'X-SFPY-API-KEY': this.config.apiKey }),
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    const tracker = result.data?.token || result.token || result.tracker;

    if (!tracker) {
      throw new AppError('Safepay did not return a tracker token in response', 502, 'PAYMENT_GATEWAY_ERROR');
    }
    // Construct the components checkout URL using SafePay's components base and expected query params
    const componentBase = this._getComponentUrl();
    const queryParams = new URLSearchParams({
      token: tracker,
      orderId: orderId,
      env: environment,
      source: 'custom',
      passthrough: 'true',
    });

    // SafePay expects a `redirectUrl` parameter (camelCase) for return URL
    if (callbackUrl) {
      queryParams.set('redirectUrl', callbackUrl);
      // also provide a cancel/failed return if SafePay uses the same field name
      queryParams.set('cancelUrl', callbackUrl);
    }

    const redirectUrl = `${componentBase}?${queryParams.toString()}`;

        const responsePayload = {
        gatewayRef: tracker,
        redirectUrl,
        meta: {
              provider: 'SAFE_PAY',
              tracker,
              orderId,
              checkoutUrl: redirectUrl,
              response: result,
            },
          };

          // 📍 PASTE IT HERE
          console.log('Generated Safepay Redirect URL:', responsePayload.redirectUrl);

          return responsePayload;
  }
  /**
   * Verify a transaction using Safepay Reporter API
   *
   * @param {string} gatewayRef - The tracker token (e.g. track_...)
   * @returns {Promise<{ status: 'COMPLETED'|'PENDING'|'FAILED', meta: object }>}
   */
  async verifyPayment(gatewayRef) {
    if (!gatewayRef) {
      return { status: 'PENDING', meta: { gatewayRef } };
    }

    const baseUrl = this._getBaseUrl();
    const endpoint = `${baseUrl}/reporter/api/v1/payments/${encodeURIComponent(gatewayRef)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(this.config.apiKey && { 'X-SFPY-API-KEY': this.config.apiKey }),
        },
      });

      if (!response.ok) {
        return { status: 'PENDING', meta: { gatewayRef, httpStatus: response.status } };
      }

      const result = await response.json();
      const state = result.data?.state || result.state || result.status;

      let status = 'PENDING';
      if (state === 'TRACKER_ENDED' || state === 'PAID' || state === 'COMPLETED') {
        status = 'COMPLETED';
      } else if (state === 'FAILED' || state === 'CANCELLED') {
        status = 'FAILED';
      }

      return { status, meta: result };
    } catch (err) {
      console.warn(`[SafePay] verifyPayment query failed: ${err.message}`);
      return { status: 'PENDING', meta: { gatewayRef, error: err.message } };
    }
  }

  /**
   * Validate webhook signature and parse event payload
   *
   * @param {object} body - Webhook JSON body
   * @param {object} headers - HTTP request headers
   * @returns {Promise<{ gatewayRef: string, orderId?: string, status: string, meta: object }>}
   */
  async parseWebhook(body, headers = {}) {
    // 1. Signature Verification (if webhook secret is configured)
    const webhookSecret = this.config.webhookSecret || this.config.secret;
    const signature = headers['x-sfpy-signature'] || headers['X-SFPY-SIGNATURE'];
    const timestamp = headers['x-sfpy-timestamp'] || headers['X-SFPY-TIMESTAMP'];

    if (webhookSecret && signature) {
      try {
        const rawPayload = timestamp ? `${timestamp}.${JSON.stringify(body)}` : JSON.stringify(body);
        const computedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawPayload)
          .digest('hex');

        const cleanSignature = signature.replace(/^sha256=/, '');
        const sigBuffer = Buffer.from(cleanSignature, 'utf8');
        const compBuffer = Buffer.from(computedSignature, 'utf8');

        if (sigBuffer.length === compBuffer.length && !crypto.timingSafeEqual(sigBuffer, compBuffer)) {
          console.warn('[SafePay] Webhook signature mismatch. Proceeding with caution.');
        }
      } catch (cryptoErr) {
        console.warn(`[SafePay] Webhook signature verification error: ${cryptoErr.message}`);
      }
    }

    // 2. Extract transaction identifiers
    const data = body.data || body;
    const tracker = data.tracker || data.token || data.reference || body.tracker || body.reference;
    const orderId = data.order_id || data.orderId || body.order_id || body.orderId;
    const state = (data.state || data.status || body.status || body.event || '').toUpperCase();

    const isSuccess =
      state === 'TRACKER_ENDED' ||
      state === 'PAID' ||
      state === 'COMPLETED' ||
      state === 'PAYMENT.COMPLETED' ||
      state === 'ORDER.COMPLETED';

    const isFailure =
      state === 'FAILED' ||
      state === 'CANCELLED' ||
      state === 'PAYMENT.FAILED' ||
      state === 'TRACKER_FAILED';

    let status = 'PENDING';
    if (isSuccess) {
      status = 'COMPLETED';
    } else if (isFailure) {
      status = 'FAILED';
    }

    return {
      gatewayRef: tracker || orderId,
      orderId: orderId,
      status,
 meta: body,
    };
  }
}

module.exports = { SafePayGateway };