'use strict';

/**
 * Donation Entity
 */
class DonationEntity {
  constructor({ id, userId, eventId, amount, currency, status, gateway, gatewayRef, createdAt }) {
    this.id = id;
    this.userId = userId;
    this.eventId = eventId;
    this.amount = amount;
    this.currency = currency || 'PKR';
    this.status = status;
    this.gateway = gateway;
    this.gatewayRef = gatewayRef || null;
    this.createdAt = createdAt;
  }

  isPending() {
    return this.status === 'PENDING';
  }

  isCompleted() {
    return this.status === 'COMPLETED';
  }

  isFailed() {
    return this.status === 'FAILED';
  }
}

module.exports = { DonationEntity };
