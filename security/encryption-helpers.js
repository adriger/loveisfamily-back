'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a key from a passphrase using PBKDF2.
 * @param {string} passphrase
 * @param {Buffer} salt
 * @returns {Buffer}
 */
function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a string value using AES-256-GCM.
 * @param {string} plaintext
 * @param {string} keyHex - 64-char hex key
 * @returns {string} Base64-encoded encrypted payload
 */
function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * @param {string} ciphertextBase64
 * @param {string} keyHex
 * @returns {string} Decrypted plaintext
 */
function decrypt(ciphertextBase64, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const data = Buffer.from(ciphertextBase64, 'base64');
  const iv = data.slice(0, IV_LENGTH);
  const tag = data.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.slice(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Generates a new random encryption key.
 * @returns {string} 64-char hex key
 */
function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Hashes a value using SHA-256 (for non-reversible fields like email lookup).
 * @param {string} value
 * @returns {string}
 */
function hashValue(value) {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

/**
 * Encrypts sensitive user fields before storing in Firestore.
 * @param {object} userData - Raw user data
 * @param {string} keyHex
 * @returns {object} User data with sensitive fields encrypted
 */
function encryptSensitiveFields(userData, keyHex) {
  const result = { ...userData };
  const sensitiveFields = ['phone_number', 'date_of_birth', 'national_id'];
  for (const field of sensitiveFields) {
    if (result[field]) {
      result[`${field}_encrypted`] = encrypt(String(result[field]), keyHex);
      result[`${field}_hash`] = hashValue(String(result[field]));
      delete result[field];
    }
  }
  return result;
}

/**
 * Decrypts sensitive user fields after reading from Firestore.
 * @param {object} userData
 * @param {string} keyHex
 * @returns {object}
 */
function decryptSensitiveFields(userData, keyHex) {
  const result = { ...userData };
  const sensitiveFields = ['phone_number', 'date_of_birth', 'national_id'];
  for (const field of sensitiveFields) {
    if (result[`${field}_encrypted`]) {
      try {
        result[field] = decrypt(result[`${field}_encrypted`], keyHex);
        delete result[`${field}_encrypted`];
        delete result[`${field}_hash`];
      } catch {
        // Decryption failed — key may have been rotated
        delete result[`${field}_encrypted`];
      }
    }
  }
  return result;
}

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  hashValue,
  encryptSensitiveFields,
  decryptSensitiveFields,
  deriveKey,
};
