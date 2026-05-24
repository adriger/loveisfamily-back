'use strict';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

function validateEmail(email) {
  if (!email || typeof email !== 'string') return { valid: false, error: 'Email required' };
  if (!EMAIL_REGEX.test(email.trim())) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

function validatePassword(password) {
  if (!password) return { valid: false, error: 'Password required' };
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (!PASSWORD_REGEX.test(password)) {
    return { valid: false, error: 'Password must contain uppercase, number, and special character' };
  }
  return { valid: true };
}

/**
 * Checks if a password was used recently (last 5 passwords).
 * Requires hashed password history stored in Firestore.
 * @param {string} userId
 * @param {string} newPasswordHash
 * @returns {Promise<boolean>}
 */
async function isPasswordReused(userId, newPasswordHash) {
  const admin = require('firebase-admin');
  const db = admin.firestore();
  const historyDoc = await db.collection('password_history').doc(userId).get();
  if (!historyDoc.exists) return false;
  const history = historyDoc.data().hashes || [];
  return history.includes(newPasswordHash);
}

/**
 * Stores a new password hash in history (keeps last 5).
 */
async function storePasswordHistory(userId, passwordHash) {
  const admin = require('firebase-admin');
  const db = admin.firestore();
  const ref = db.collection('password_history').doc(userId);
  const doc = await ref.get();
  const hashes = doc.exists ? (doc.data().hashes || []) : [];
  const updated = [passwordHash, ...hashes].slice(0, 5);
  await ref.set({ hashes: updated, updated_at: FieldValue.serverTimestamp() });
}

function verifyCustomClaim(decodedToken, claim, expectedValue) {
  if (!decodedToken || !decodedToken[claim]) return false;
  if (expectedValue !== undefined) return decodedToken[claim] === expectedValue;
  return true;
}

function isSubscriptionValid(decodedToken) {
  const tier = decodedToken?.subscription_type;
  const endDate = decodedToken?.subscription_end_date;
  if (!tier || tier === 'free') return true;
  if (!endDate) return false;
  return endDate > Date.now();
}

module.exports = {
  validateEmail,
  validatePassword,
  isPasswordReused,
  storePasswordHistory,
  verifyCustomClaim,
  isSubscriptionValid,
};
