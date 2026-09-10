'use strict';

const crypto = require('node:crypto');
const { BasePaymentGateway } = require('../../domain/interfaces/payment');
const { AppError } = require('../../core/exceptions');

/**
 * Safepay Payment Gateway Adapter
 * Official Documentation: https://getsafepay.com
 */
class SafePayGateway extends BasePaymentGateway {
  constructor(config) {
    super(config);
  }

  _getClientKey() {
    return this.config.publicKey || this.config.apiKey;
  }

  _getMerchantSecret() {
    return this.config.merchantSecret || this.config.secret || this.config.apiKey;
  }

  _isSandbox() {
    const base = (this.config.baseUrl || '').toLowerCase();
    return (
      base.includes('sandbox') || base.includes('dev') || process.env.NODE_ENV !== 'production'
    );
  }

  _getBaseUrl() {
    const raw = (this.config.baseUrl || 'https://sandbox.api.getsafepay.com').replace(/\/$/, '');
    if (raw.includes('dev.api.getsafepay.com')) {
      return 'https://sandbox.api.getsafepay.com';
    }
    return raw;
  }

  _getComponentUrl() {
    if (this._isSandbox()) {
      return 'https://sandbox.api.getsafepay.com/checkout/pay';
    }
    return 'https://getsafepay.com/checkout/pay';
  }

  _getPaymentState(payload) {
    const candidates = [
      payload?.state,
      payload?.status,
      payload?.event,
      payload?.type,
      payload?.transaction?.state,
      payload?.transaction?.status,
      payload?.payment?.state,
      payload?.payment?.status,
      payload?.data?.state,
      payload?.data?.status,
      payload?.data?.transaction?.state,
      payload?.data?.transaction?.status,
      payload?.data?.payment?.state,
      payload?.data?.payment?.status,
    ];

    return candidates.find((value) => typeof value === 'string')?.toUpperCase() || '';
  }

  async initiatePayment({
    amount,
    currency = 'PKR',
    orderId,
    _description,
    callbackUrl,
    cancelUrl,
    _webhookUrl,
  }) {
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
    const merchantSecret = this._getMerchantSecret();

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
        ...(merchantSecret && { 'X-SFPY-MERCHANT-SECRET': merchantSecret }),
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    const tracker = result.data?.token || result.token || result.tracker;

    if (!tracker) {
      throw new AppError(
        'Safepay did not return a tracker token in response',
        502,
        'PAYMENT_GATEWAY_ERROR'
      );
    }

    const targetCallback =
      callbackUrl ||
      this.config.callbackUrl ||
      process.env.CLIENT_URL ||
      'http://localhost:5173/donate';

    const checkoutPayload = {
      token: tracker,
      order_id: orderId,
      source: 'custom',
      webhooks: 'true',
      success_url: targetCallback,
      cancel_url: cancelUrl || targetCallback,
    };

    const componentBase = this._getComponentUrl();
    const queryParams = new URLSearchParams({
      beacon: checkoutPayload.token,
      tracker: checkoutPayload.token,
      env: environment,
      source: checkoutPayload.source,
      webhooks: checkoutPayload.webhooks,
      success_url: checkoutPayload.success_url,
      cancel_url: checkoutPayload.cancel_url,
      order_id: checkoutPayload.order_id,
      passthrough: 'true',
      redirect_url: checkoutPayload.success_url,
    });

    const redirectUrl = `${componentBase}?${queryParams.toString()}`;

    return {
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
  }

  async verifyPayment(gatewayRef) {
    if (!gatewayRef) {
      return { status: 'PENDING', meta: { gatewayRef } };
    }

    const baseUrl = this._getBaseUrl();
    const endpoint = `${baseUrl}/order/v1/tracker/${encodeURIComponent(gatewayRef)}`;
    const merchantSecret = this._getMerchantSecret();
    const authHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(merchantSecret && { 'X-SFPY-MERCHANT-SECRET': merchantSecret }),
    };

    try {
      let response = await fetch(endpoint, {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        // Fallback check to reporter API
        const reporterUrl = `${baseUrl}/reporter/api/v1/payments/${encodeURIComponent(gatewayRef)}`;
        response = await fetch(reporterUrl, {
          method: 'GET',
          headers: authHeaders,
        });
      }

      if (!response.ok) {
        return { status: 'PENDING', meta: { gatewayRef, httpStatus: response.status } };
      }

      const result = await response.json();
      const data = result.data || result;
      const state = this._getPaymentState(result) || (data.tracker?.state || '').toUpperCase();

      const isSuccess =
        state === 'CYBERSOURCE' ||
        state === 'TRACKER_ENDED' ||
        state === 'PAID' ||
        state === 'COMPLETED' ||
        state === 'SETTLED' ||
        state === 'PAYMENT.COMPLETED' ||
        state === 'PAYMENT.SUCCEEDED';

      const isFailure =
        state === 'FAILED' ||
        state === 'CANCELLED' ||
        state === 'TRACKER_FAILED' ||
        state === 'PAYMENT.FAILED';

      let status = 'PENDING';
      if (isSuccess) {
        status = 'COMPLETED';
      } else if (isFailure) {
        status = 'FAILED';
      }

      return { status, meta: result };
    } catch (err) {
      console.warn(`[SafePay] verifyPayment query failed: ${err.message}`);
      return { status: 'PENDING', meta: { gatewayRef, error: err.message } };
    }
  }

  async parseWebhook(body, headers = {}, _initialParsedBody) {
    const webhookSecret = this.config.webhookSecret || this.config.secret;
    const signature = headers['x-sfpy-signature'] || headers['X-SFPY-SIGNATURE'];
    const timestamp = headers['x-sfpy-timestamp'] || headers['X-SFPY-TIMESTAMP'];

    if (!webhookSecret || !signature || !timestamp) {
      throw new AppError(
        'SafePay webhook signature and timestamp are required',
        401,
        'INVALID_WEBHOOK_SIGNATURE'
      );
    }

    const timestampNumber = Number(timestamp);
    const timestampSeconds = timestampNumber > 1e12 ? timestampNumber / 1000 : timestampNumber;
    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > 300
    ) {
      throw new AppError('Stale SafePay webhook timestamp', 401, 'INVALID_WEBHOOK_SIGNATURE');
    }

    try {
      const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      const key = Buffer.from(webhookSecret, 'base64');
      const expected = `sha256=${crypto
        .createHmac('sha256', key)
        .update(`${timestamp}.${rawBody.toString('utf8')}`)
        .digest('hex')}`;
      const expectedBuffer = Buffer.from(expected);
      const actualBuffer = Buffer.from(String(signature));
      if (
        expectedBuffer.length !== actualBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
      ) {
        throw new AppError('Invalid SafePay webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE');
      }
    } catch (cryptoErr) {
      if (cryptoErr instanceof AppError) throw cryptoErr;
      throw new AppError('Invalid SafePay webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE');
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body));
    } catch {
      throw new AppError('Invalid SafePay webhook JSON', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
      throw new AppError('Invalid SafePay webhook payload', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }

    const data = parsedPayload.data || parsedPayload;

    const tracker =
      parsedPayload.token ||
      parsedPayload.tracker ||
      data.token ||
      data.tracker ||
      parsedPayload.order_id;

    const orderId =
      data.order_id || data.orderId || parsedPayload.order_id || parsedPayload.orderId;

    const metadata = Array.isArray(parsedPayload.payment_metadata)
      ? parsedPayload.payment_metadata
      : Array.isArray(data.payment_metadata)
        ? data.payment_metadata
        : [];
    const metadataOrderId = metadata.find((item) => item?.meta_key === 'order_id')?.meta_value;

    const rawEvent = [
      parsedPayload.type,
      parsedPayload.event,
      data.type,
      data.event,
      headers['x-sfpy-event-type'],
    ].find((value) => typeof value === 'string');
    const event = (rawEvent || '').toLowerCase();
    console.info('[Safepay event.type]', rawEvent || '');

    const statusByEvent = {
      'payment:created': 'PENDING',
      'payment.created': 'PENDING',
      'payment.succeeded': 'COMPLETED',
      'payment:succeeded': 'COMPLETED',
      'payment.failed': 'FAILED',
      'payment:failed': 'FAILED',
      'payment.refunded': 'REFUNDED',
      'payment:refunded': 'REFUNDED',
      'refund:created': null,
      'refund.created': null,
      'error:occurred': null,
      'error.occurred': null,
    };
    const status = Object.prototype.hasOwnProperty.call(statusByEvent, event)
      ? statusByEvent[event]
      : null;
    const eventId = headers['x-sfpy-event-id'] || headers['X-SFPY-EVENT-ID'] || parsedPayload.id;
    const paymentId = data.payment_id || data.paymentId || data.id || parsedPayload.payment_id;
    const transactionId = data.transaction_id || data.transactionId || data.settlement_id;

    return {
      gatewayRef: tracker || orderId || metadataOrderId,
      orderId: orderId || metadataOrderId,
      eventId,
      paymentId,
      transactionId,
      status,
      eventType: event,
      meta: parsedPayload,
    };
  }
}

module.exports = { SafePayGateway };
