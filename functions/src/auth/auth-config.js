'use strict';

const admin = require('firebase-admin');

/**
 * Sets custom claims on a user after creation.
 * Called by auth.onCreate trigger.
 * @param {string} uid
 * @param {object} claims
 */
async function setCustomClaims(uid, claims = {}) {
  const defaultClaims = {
    subscription_type: 'free',
    subscription_end_date: null,
    user_role: 'user',
    email_verified: false,
    created_at: Date.now(),
  };
  await admin.auth().setCustomUserClaims(uid, { ...defaultClaims, ...claims });
  console.info(`Custom claims set: uid=${uid}`);
}

/**
 * Updates subscription claims when user upgrades.
 * @param {string} uid
 * @param {string} subscriptionType
 * @param {number} endDateMs
 */
async function updateSubscriptionClaims(uid, subscriptionType, endDateMs) {
  const user = await admin.auth().getUser(uid);
  const existingClaims = user.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, {
    ...existingClaims,
    subscription_type: subscriptionType,
    subscription_end_date: endDateMs,
  });
  // Force token refresh by revoking all existing sessions
  await admin.auth().revokeRefreshTokens(uid);
  console.info(`Subscription claims updated: uid=${uid} tier=${subscriptionType}`);
}

/**
 * Marks email as verified in custom claims.
 * @param {string} uid
 */
async function markEmailVerified(uid) {
  const user = await admin.auth().getUser(uid);
  const existingClaims = user.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existingClaims, email_verified: true });
}

/**
 * Revokes all sessions for a user (logout from all devices).
 * @param {string} uid
 */
async function revokeAllSessions(uid) {
  await admin.auth().revokeRefreshTokens(uid);
  console.info(`All sessions revoked: uid=${uid}`);
}

/**
 * Generates a password reset link via Firebase Auth.
 * @param {string} email
 * @returns {Promise<string>} Reset link URL
 */
async function generatePasswordResetLink(email) {
  const actionCodeSettings = {
    url: process.env.APP_DEEP_LINK_URL || 'https://app.example.com/reset-password',
    handleCodeInApp: true,
  };
  return admin.auth().generatePasswordResetLink(email, actionCodeSettings);
}

/**
 * Generates email verification link.
 * @param {string} email
 * @returns {Promise<string>}
 */
async function generateEmailVerificationLink(email) {
  const actionCodeSettings = {
    url: process.env.APP_DEEP_LINK_URL || 'https://app.example.com/verify-email',
    handleCodeInApp: true,
  };
  return admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
}

/**
 * Lists all active sessions/devices for a user.
 * @param {string} uid
 * @returns {Promise<object>}
 */
async function getUserSessions(uid) {
  const user = await admin.auth().getUser(uid);
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    tokensValidAfterTime: user.tokensValidAfterTime,
    customClaims: user.customClaims,
  };
}

/**
 * Disables a user account (admin action or security lock).
 * @param {string} uid
 */
async function disableUser(uid, reason = 'security') {
  await admin.auth().updateUser(uid, { disabled: true });
  console.warn(`User account disabled: uid=${uid} reason=${reason}`);
}

/**
 * Re-enables a user account.
 * @param {string} uid
 */
async function enableUser(uid) {
  await admin.auth().updateUser(uid, { disabled: false });
  console.info(`User account re-enabled: uid=${uid}`);
}

/**
 * Verifies an ID token and returns decoded claims.
 * @param {string} idToken
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
async function verifyIdToken(idToken) {
  try {
    return await admin.auth().verifyIdToken(idToken, true); // checkRevoked = true
  } catch (err) {
    if (err.code === 'auth/id-token-revoked') {
      throw { code: 'TOKEN_REVOKED', message: 'Token has been revoked. Please sign in again.' };
    }
    throw { code: 'TOKEN_INVALID', message: 'Invalid authentication token.' };
  }
}

module.exports = {
  setCustomClaims,
  updateSubscriptionClaims,
  markEmailVerified,
  revokeAllSessions,
  generatePasswordResetLink,
  generateEmailVerificationLink,
  getUserSessions,
  disableUser,
  enableUser,
  verifyIdToken,
};
