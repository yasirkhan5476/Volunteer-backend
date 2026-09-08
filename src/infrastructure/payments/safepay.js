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
      base.includes('sandbox') ||
      base.includes('dev') ||
      process.env.NODE_ENV !== 'production'
    );
  }

  _getBaseUrl() {
    const raw = (
      this.config.baseUrl || 'https://sandbox.api.getsafepay.com'
    ).replace(/\/$/, '');
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
    description,
    callbackUrl,
    webhookUrl,
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
    const checkoutPath = (this.config.checkoutPath || '/order/v1/init').replace(
      /^\//,
      ''
    );
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

    const componentBase = this._getComponentUrl();
    const queryParams = new URLSearchParams({
      beacon: tracker,
      tracker: tracker,
      env: environment,
      source: 'custom',
      order_id: orderId,
      passthrough: 'true',
      redirect_url: targetCallback,
      cancel_url: targetCallback,
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

  async parseWebhook(body, headers = {}, initialParsedBody) {
    const webhookSecret = this.config.webhookSecret || this.config.secret;
    const signature = headers['x-sfpy-signature'] || headers['X-SFPY-SIGNATURE'];
    const timestamp = headers['x-sfpy-timestamp'] || headers['X-SFPY-TIMESTAMP'];

    if (webhookSecret && !signature) {
      throw new AppError(
        'SafePay webhook signature is required',
        401,
        'INVALID_WEBHOOK_SIGNATURE'
      );
    }

    if (webhookSecret && signature) {
      try {
        const payloadString = Buffer.isBuffer(body)
          ? body.toString('utf8')
          : typeof body === 'string'
            ? body
            : JSON.stringify(body);
        const rawPayload = timestamp ? `${timestamp}.${payloadString}` : payloadString;

        const computedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawPayload)
          .digest('hex');

        const cleanSignature = signature.replace(/^sha256=/, '');
        const sigBuffer = Buffer.from(cleanSignature, 'utf8');
        const compBuffer = Buffer.from(computedSignature, 'utf8');

        if (
          sigBuffer.length !== compBuffer.length ||
          !crypto.timingSafeEqual(sigBuffer, compBuffer)
        ) {
          throw new AppError(
            'Invalid SafePay webhook signature',
            401,
            'INVALID_WEBHOOK_SIGNATURE'
          );
        }
      } catch (cryptoErr) {
        if (cryptoErr instanceof AppError) throw cryptoErr;
        throw new AppError(
          'Invalid SafePay webhook signature',
          401,
          'INVALID_WEBHOOK_SIGNATURE'
        );
      }
    }

    let parsedPayload;
    try {
      parsedPayload = initialParsedBody || (
        Buffer.isBuffer(body)
          ? JSON.parse(body.toString('utf8'))
          : typeof body === 'string'
            ? JSON.parse(body)
            : body
      );
    } catch {
      throw new AppError('Invalid SafePay webhook JSON', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
      throw new AppError('Invalid SafePay webhook payload', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }

    const data = parsedPayload.data || parsedPayload;

    const tracker =
      data.token ||
      data.tracker ||
      data.reference ||
      parsedPayload.token ||
      parsedPayload.tracker ||
      parsedPayload.gatewayRef;

    const orderId =
      data.order_id || data.orderId || parsedPayload.order_id || parsedPayload.orderId;

    const metadata = Array.isArray(parsedPayload.payment_metadata)
      ? parsedPayload.payment_metadata
      : Array.isArray(data.payment_metadata)
        ? data.payment_metadata
        : [];
    const metadataOrderId = metadata.find((item) => item?.meta_key === 'order_id')?.meta_value;

    const rawEvent = [
      parsedPayload.event,
      parsedPayload.type,
      parsedPayload.intent,
      data.event,
      data.type,
      data.intent,
    ].find((value) => typeof value === 'string');
    const event = (rawEvent || '').toLowerCase();
    const state = (
      data.state ||
      data.status ||
      parsedPayload.state ||
      parsedPayload.status ||
      parsedPayload.intent ||
      data.intent ||
      this._getPaymentState(parsedPayload) ||
      ''
    ).toUpperCase();

    const isCreated = event === 'payment:created' || event === 'payment.created';
    const isSuccess =
      event === 'payment.succeeded' ||
      event === 'payment:succeeded' ||
      ['CYBERSOURCE', 'PAID', 'COMPLETED'].includes(state);
    const isFailure =
      event === 'payment.failed' ||
      event === 'payment:failed' ||
      ['CANCELLED', 'FAILED'].includes(state);

    const status = isCreated
      ? 'PENDING'
      : isSuccess
        ? 'COMPLETED'
        : isFailure
          ? 'FAILED'
          : 'PENDING';
    const eventType = isCreated
      ? 'payment:created'
      : isSuccess
        ? 'payment.succeeded'
        : isFailure
          ? 'payment.failed'
          : event;

    return {
      gatewayRef: tracker || orderId || metadataOrderId,
      orderId: orderId || metadataOrderId,
      status,
      eventType,
      meta: parsedPayload,
    };
  }
}

module.exports = { SafePayGateway };