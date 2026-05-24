'use strict';

const admin = require('firebase-admin');
const { computeCompatibilityScore, applyDiversityFilter, MINIMUM_MATCH_THRESHOLD } = require('./matching-algorithm');
const { TIER_LIMITS, SUBSCRIPTION_TIERS } = require('../shared/constants');

const db = admin.firestore();
const CANDIDATE_POOL_LIMIT = 500;

/**
 * Generates a candidate pool for matching by querying Firestore.
 * Filters: age range, active users (last login < 7 days), not already matched.
 * @param {object} user - The requesting user
 * @param {object} tierLimits
 * @param {Set<string>} excludeIds
 * @returns {Promise<Array>}
 */
async function generateCandidatePool(user, tierLimits, excludeIds) {
  const ageMin = user.age ? Math.max(18, user.age - tierLimits.age_range) : 18;
  const ageMax = user.age ? user.age + tierLimits.age_range : 99;

  const snap = await db.collection('users')
    .where('age', '>=', ageMin)
    .where('age', '<=', ageMax)
    .limit(CANDIDATE_POOL_LIMIT)
    .get();

  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;

  return snap.docs
    .filter(doc => {
      if (excludeIds.has(doc.id)) return false;
      const data = doc.data();
      // Exclude inactive users
      const lastLogin = data.last_login_at?.toMillis() || data.created_at?.toMillis() || 0;
      return lastLogin > sevenDaysAgo;
    })
    .map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Scores candidates in batches of 100 for performance.
 * @param {object} requestingUser
 * @param {Array} candidates
 * @param {object} tierLimits
 * @returns {Array} Scored candidates, filtered by minimum threshold
 */
function scoreCandidatesBatch(requestingUser, candidates, tierLimits) {
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    for (const candidate of batch) {
      const { score, breakdown } = computeCompatibilityScore(
        requestingUser,
        candidate,
        {
          maxDistanceKm: tierLimits.radius_km,
          maxAgeDifference: tierLimits.age_range,
          subscriptionBoost: tierLimits.priority_boost || 0,
        }
      );

      if (score >= MINIMUM_MATCH_THRESHOLD) {
        results.push({
          user_id: candidate.id,
          username: candidate.username,
          displayName: candidate.displayName,
          age: candidate.age,
          interests: candidate.interests || [],
          photoURL: candidate.photoURL,
          bio: candidate.bio,
          subscription_type: candidate.subscription_type,
          compatibility_score: score,
          breakdown,
          distance_km: requestingUser.location && candidate.location
            ? Math.round(require('./matching-algorithm').haversineKm(requestingUser.location, candidate.location) * 10) / 10
            : null,
        });
      }
    }
  }

  return results;
}

/**
 * Gets already-matched user IDs to exclude from suggestions.
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
async function getExcludedUserIds(userId) {
  const [m1, m2] = await Promise.all([
    db.collection('matches').where('user1_id', '==', userId).get(),
    db.collection('matches').where('user2_id', '==', userId).get(),
  ]);
  const excluded = new Set([userId]);
  m1.docs.forEach(d => excluded.add(d.data().user2_id));
  m2.docs.forEach(d => excluded.add(d.data().user1_id));
  return excluded;
}

/**
 * Full matching pipeline: generate pool → score → rank → diversify.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function generateSuggestions(userId, limit = 10) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw new Error('User not found');

  const user = { id: userId, ...userDoc.data() };
  const tier = user.subscription_type || SUBSCRIPTION_TIERS.FREE;
  const tierLimits = TIER_LIMITS[tier];

  const excludeIds = await getExcludedUserIds(userId);
  const candidates = await generateCandidatePool(user, tierLimits, excludeIds);

  let scored = scoreCandidatesBatch(user, candidates, tierLimits);
  scored.sort((a, b) => b.compatibility_score - a.compatibility_score);
  scored = applyDiversityFilter(scored);

  return scored.slice(0, limit);
}

module.exports = { generateCandidatePool, scoreCandidatesBatch, getExcludedUserIds, generateSuggestions };
