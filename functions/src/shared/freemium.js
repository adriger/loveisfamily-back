'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');
const { TIER_LIMITS, SUBSCRIPTION_TIERS, ERROR_CODES } = require('../shared/constants');
const { updateSubscriptionClaims } = require('../auth/auth-config');

const db = admin.firestore();

/**
 * Checks whether a user can perform a feature action based on their subscription tier.
 * @param {string} userId
 * @param {string} feature - 'matches', 'teams', 'posts', 'messages'
 * @returns {Promise<{ allowed: boolean, remaining?: number, error?: string }>}
 */
async function checkSubscriptionLimits(userId, feature) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'User not found' };

  const { subscription_type = SUBSCRIPTION_TIERS.FREE } = userDoc.data();
  const limits = TIER_LIMITS[subscription_type];

  const limitsDoc = await db.collection('user_limits').doc(userId).get();
  const usage = limitsDoc.exists ? limitsDoc.data() : {};

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  if (feature === 'matches') {
    const limit = limits.matches_per_day;
    if (limit === Infinity) return { allowed: true, remaining: Infinity };
    const used = (usage.last_match_reset_date?.toMillis() >= todayStart.getTime())
      ? (usage.matches_today || 0)
      : 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used) };
  }

  if (feature === 'teams') {
    const limit = limits.teams_per_month;
    if (limit === 0) return { allowed: false, remaining: 0, error: 'Team creation requires Premium or VIP subscription' };
    if (limit === Infinity) return { allowed: true, remaining: Infinity };
    const used = (usage.last_team_reset_date?.toMillis() >= monthStart.getTime())
      ? (usage.teams_created_month || 0)
      : 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used) };
  }

  if (feature === 'posts') {
    const limit = limits.posts_per_day;
    if (limit === Infinity) return { allowed: true, remaining: Infinity };
    const used = (usage.last_post_reset_date?.toMillis() >= todayStart.getTime())
      ? (usage.posts_today || 0)
      : 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used) };
  }

  return { allowed: true };
}

/**
 * Atomically increments a feature usage counter for the user.
 * @param {string} userId
 * @param {string} feature - 'matches', 'teams', 'posts'
 * @returns {Promise<void>}
 */
async function incrementFeatureUsage(userId, feature) {
  const ref = db.collection('user_limits').doc(userId);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.exists ? doc.data() : {};

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const updates = { updated_at: now };

    if (feature === 'matches') {
      const isToday = data.last_match_reset_date?.toMillis() >= todayStart.getTime();
      updates.matches_today = isToday ? (data.matches_today || 0) + 1 : 1;
      updates.last_match_reset_date = now;
    } else if (feature === 'teams') {
      const isThisMonth = data.last_team_reset_date?.toMillis() >= monthStart.getTime();
      updates.teams_created_month = isThisMonth ? (data.teams_created_month || 0) + 1 : 1;
      updates.last_team_reset_date = now;
    } else if (feature === 'posts') {
      const isToday = data.last_post_reset_date?.toMillis() >= todayStart.getTime();
      updates.posts_today = isToday ? (data.posts_today || 0) + 1 : 1;
      updates.last_post_reset_date = now;
    }

    t.set(ref, updates, { merge: true });
  });
}

/**
 * Upgrades or sets a user's subscription tier.
 * @param {string} userId
 * @param {string} tier - 'premium' | 'vip'
 * @param {string} paymentId - External payment reference
 * @returns {Promise<void>}
 */
async function upgradeSubscription(userId, tier, paymentId) {
  if (!Object.values(SUBSCRIPTION_TIERS).includes(tier)) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Invalid subscription tier' };
  }
  if (!paymentId) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Payment ID is required' };
  }

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 1);

  await db.collection('users').doc(userId).update({
    subscription_type: tier,
    subscription_end_date: Timestamp.fromDate(expiryDate),
    updated_at: FieldValue.serverTimestamp(),
  });

  await db.collection('subscription_history').add({
    user_id: userId,
    tier,
    payment_id: paymentId,
    start_date: FieldValue.serverTimestamp(),
    end_date: Timestamp.fromDate(expiryDate),
    created_at: FieldValue.serverTimestamp(),
  });

  // Update JWT claims so the new tier is reflected in the next token refresh
  await updateSubscriptionClaims(userId, tier, expiryDate.getTime());

  console.info(`Subscription upgraded: user=${userId} tier=${tier} payment=${paymentId}`);
}

module.exports = { checkSubscriptionLimits, incrementFeatureUsage, upgradeSubscription };
