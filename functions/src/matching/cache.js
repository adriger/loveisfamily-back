'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();

// In-memory LRU cache for active Cloud Function instances
const lruCache = new Map();
const LRU_MAX_SIZE = 1000;
const LRU_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Gets cached suggestions for a user from Firestore.
 * @param {string} userId
 * @param {string} tier
 * @returns {Promise<Array | null>} null if cache miss or expired
 */
async function getCachedSuggestions(userId, tier) {
  // Check in-memory LRU first
  const lruKey = `suggestions_${userId}`;
  const lruEntry = lruCache.get(lruKey);
  if (lruEntry && Date.now() - lruEntry.ts < LRU_TTL_MS) {
    return lruEntry.data;
  }

  const cacheDoc = await db.collection('match_cache').doc(userId).get();
  if (!cacheDoc.exists) return null;

  const cache = cacheDoc.data();
  const cacheTTL = getCacheTTL(tier);
  const ageMs = Date.now() - (cache.generated_at?.toMillis() || 0);

  if (ageMs > cacheTTL) return null; // Expired

  // Populate LRU
  lruCache.set(lruKey, { data: cache.suggestions, ts: Date.now() });
  if (lruCache.size > LRU_MAX_SIZE) {
    lruCache.delete(lruCache.keys().next().value);
  }

  return cache.suggestions || null;
}

/**
 * Stores suggestion cache for a user in Firestore.
 * @param {string} userId
 * @param {Array} suggestions - Max 100 entries
 * @param {string} tier
 */
async function setCachedSuggestions(userId, suggestions, tier) {
  await db.collection('match_cache').doc(userId).set({
    suggestions: suggestions.slice(0, 100),
    generated_at: FieldValue.serverTimestamp(),
    tier,
    count: suggestions.length,
  });

  // Update LRU
  lruCache.set(`suggestions_${userId}`, { data: suggestions.slice(0, 100), ts: Date.now() });
}

/**
 * Invalidates the cache for a user (e.g., after profile update).
 * @param {string} userId
 */
async function invalidateCache(userId) {
  await db.collection('match_cache').doc(userId).delete();
  lruCache.delete(`suggestions_${userId}`);
}

/**
 * Returns cache TTL in milliseconds based on subscription tier.
 */
function getCacheTTL(tier) {
  switch (tier) {
    case 'vip': return 2 * 3600 * 1000;      // 2 hours
    case 'premium': return 6 * 3600 * 1000;   // 6 hours
    default: return 24 * 3600 * 1000;          // 24 hours
  }
}

/**
 * Pre-computes suggestion caches for all active users (scheduled nightly).
 * "Active" = last login within 24 hours.
 */
async function batchPrecomputeSuggestions(generateFn) {
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const activeUsers = await db.collection('users')
    .where('last_login_at', '>=', Timestamp.fromDate(oneDayAgo))
    .limit(500)
    .get();

  let computed = 0;
  for (const userDoc of activeUsers.docs) {
    try {
      const suggestions = await generateFn(userDoc.id, 100);
      await setCachedSuggestions(userDoc.id, suggestions, userDoc.data().subscription_type || 'free');
      computed++;
    } catch (err) {
      console.warn(`Cache precompute failed for ${userDoc.id}: ${err.message}`);
    }
  }

  console.info(`Batch precomputed suggestions for ${computed}/${activeUsers.size} active users`);
  return { computed };
}

/**
 * Returns current LRU cache statistics.
 */
function getCacheStats() {
  return {
    lru_size: lruCache.size,
    lru_max: LRU_MAX_SIZE,
    lru_ttl_ms: LRU_TTL_MS,
  };
}

module.exports = {
  getCachedSuggestions,
  setCachedSuggestions,
  invalidateCache,
  getCacheTTL,
  batchPrecomputeSuggestions,
  getCacheStats,
};
