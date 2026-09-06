'use strict';

/**
 * Passport Entity — represents a signed volunteer certificate.
 */
class PassportEntity {
  constructor({ id, userId, pdfUrl, signature, publicKey, status, issuedAt, expiresAt }) {
    this.id = id;
    this.userId = userId;
    this.pdfUrl = pdfUrl || null;
    this.signature = signature;
    this.publicKey = publicKey;
    this.status = status;
    this.issuedAt = new Date(issuedAt);
    this.expiresAt = new Date(expiresAt);
  }

  isActive() {
    return this.status === 'ACTIVE' && new Date() < this.expiresAt;
  }

  isExpired() {
    return new Date() >= this.expiresAt;
  }

  isRevoked() {
    return this.status === 'REVOKED';
  }
}

module.exports = { PassportEntity };
