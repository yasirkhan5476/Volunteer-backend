'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../core/config');

/**
 * Passport Cryptography Service
 *
 * Uses ECDSA (P-256) to sign and verify volunteer passport data.
 * Keys are loaded from PEM files specified in config.
 *
 * To generate keys:
 *   openssl ecparam -genkey -name prime256v1 -noout -out keys/passport_private.pem
 *   openssl ec -in keys/passport_private.pem -pubout -out keys/passport_public.pem
 */

let _privateKey = null;
let _publicKey = null;

function loadPrivateKey() {
  if (!_privateKey) {
    const keyPath = path.resolve(config.passport.privateKeyPath);
    _privateKey = fs.readFileSync(keyPath, 'utf8');
  }
  return _privateKey;
}

function loadPublicKey() {
  if (!_publicKey) {
    const keyPath = path.resolve(config.passport.publicKeyPath);
    _publicKey = fs.readFileSync(keyPath, 'utf8');
  }
  return _publicKey;
}

/**
 * Build the canonical payload string for a passport.
 *
 * @param {{ userId: string, fullName: string, totalHours: number, issuedAt: string, expiresAt: string }} data
 * @returns {string}
 */
function buildPayload(data) {
  return JSON.stringify({
    userId: data.userId,
    fullName: data.fullName,
    totalHours: data.totalHours,
    issuedAt: data.issuedAt,
    expiresAt: data.expiresAt,
  });
}

/**
 * Sign passport payload with ECDSA private key.
 *
 * @param {object} data
 * @returns {{ payload: string, signature: string, publicKey: string }}
 */
function signPassport(data) {
  const payload = buildPayload(data);
  const privateKey = loadPrivateKey();
  const publicKey = loadPublicKey();

  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  sign.end();

  const signature = sign.sign(privateKey, 'base64');

  return { payload, signature, publicKey };
}

/**
 * Verify a passport's ECDSA signature.
 *
 * @param {string} payload - The canonical payload string
 * @param {string} signature - Base64 signature
 * @param {string} publicKeyPem - PEM public key (stored in DB)
 * @returns {boolean}
 */
function verifyPassportSignature(payload, signature, publicKeyPem) {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(payload);
    verify.end();
    return verify.verify(publicKeyPem, signature, 'base64');
  } catch {
    return false;
  }
}

module.exports = { signPassport, verifyPassportSignature, buildPayload };
