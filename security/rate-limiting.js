'use strict';

const admin = require('firebase-admin');

const db = admin.firestore();

const LIMITS = {
  signup_per_ip_per_day: 5,
  login_failed_per_email_per_15min: 10,
  api_calls_per_user_per_minute: 1000,
  messages_per_conversation_per_hour: 100,
  matches_per_day: { free: 20, premium: 100, vip: Infinity },
  posts_per_day: 10,
  team_invites_per_day: 50,
};

/**
 * Checks and increments a rate limit counter in Firestore.
 * @param {string} key - Unique identifier for this rate limit bucket
 * @param {number} limit - Max allowed count
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
async function checkRateLimit(key, limit, windowMs) {
  const ref = db.collection('rate_limits_internal').doc(encodeKey(key));
  const now = Date.now();

  return db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.exists ? doc.data() : { count: 0, window_start: now, reset_at: now + windowMs };

    const windowExpired = now >= data.reset_at;
    const count = windowExpired ? 0 : (data.count || 0);
    const resetAt = windowExpired ? now + windowMs : data.reset_at;

    if (count >= limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    t.set(ref, { count: count + 1, window_start: windowExpired ? now : data.window_start, reset_at: resetAt });
    return { allowed: true, remaining: limit - count - 1, resetAt };
  });
}

function encodeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 500);
}

/**
 * Rate limits signup attempts by IP address.
 * @param {string} ip
 */
async function checkSignupRateLimit(ip) {
  const key = `signup_ip_${ip}_${getDayKey()}`;
  return checkRateLimit(key, LIMITS.signup_per_ip_per_day, 86400000);
}

/**
 * Tracks failed login attempts per email.
 * @param {string} email
 * @returns {Promise<{ allowed: boolean, lockoutUntil?: number }>}
 */
async function trackFailedLogin(email) {
  const key = `login_failed_${email.toLowerCase()}_${get15MinKey()}`;
  const result = await checkRateLimit(key, LIMITS.login_failed_per_email_per_15min, 15 * 60 * 1000);
  if (!result.allowed) {
    return { allowed: false, lockoutUntil: result.resetAt };
  }
  return { allowed: true };
}

/**
 * General API call rate limit per user.
 * @param {string} userId
 */
async function checkApiRateLimit(userId) {
  const key = `api_${userId}_${getMinuteKey()}`;
  return checkRateLimit(key, LIMITS.api_calls_per_user_per_minute, 60000);
}

/**
 * Message rate limit per conversation.
 * @param {string} conversationId
 */
async function checkMessageRateLimit(conversationId) {
  const key = `msg_${conversationId}_${getHourKey()}`;
  return checkRateLimit(key, LIMITS.messages_per_conversation_per_hour, 3600000);
}

/**
 * Team invitation rate limit per user.
 * @param {string} userId
 */
async function checkInviteRateLimit(userId) {
  const key = `invite_${userId}_${getDayKey()}`;
  return checkRateLimit(key, LIMITS.team_invites_per_day, 86400000);
}

/**
 * Exponential backoff helper.
 * @param {number} attempt - Zero-based attempt number
 * @param {number} baseMs - Base delay in ms
 * @returns {number} Delay in ms
 */
function exponentialBackoff(attempt, baseMs = 1000) {
  return Math.min(baseMs * Math.pow(2, attempt) + Math.random() * 1000, 30000);
}

/**
 * Blocks an IP address for a specified duration.
 * @param {string} ip
 * @param {number} durationMs
 */
async function blockIp(ip, durationMs = 15 * 60 * 1000) {
  await db.collection('ip_blocks').doc(encodeKey(ip)).set({
    ip,
    blocked_until: Date.now() + durationMs,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Checks if an IP is currently blocked.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function isIpBlocked(ip) {
  const doc = await db.collection('ip_blocks').doc(encodeKey(ip)).get();
  if (!doc.exists) return false;
  return doc.data().blocked_until > Date.now();
}

// Time bucket helpers
function getDayKey() { return new Date().toISOString().slice(0, 10); }
function getHourKey() { return new Date().toISOString().slice(0, 13); }
function getMinuteKey() { return new Date().toISOString().slice(0, 16); }
function get15MinKey() {
  const d = new Date();
  const m = Math.floor(d.getMinutes() / 15) * 15;
  return `${d.toISOString().slice(0, 13)}_${m}`;
}

module.exports = {
  checkSignupRateLimit,
  trackFailedLogin,
  checkApiRateLimit,
  checkMessageRateLimit,
  checkInviteRateLimit,
  blockIp,
  isIpBlocked,
  exponentialBackoff,
  LIMITS,
};
