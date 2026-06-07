'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');
const { checkSubscriptionLimits, incrementFeatureUsage } = require('../shared/freemium');
const { ERROR_CODES, MATCH_STATUS, MATCH_TYPES, TIER_LIMITS, SUBSCRIPTION_TIERS, MATCH_EXPIRY_DAYS, MATCH_RESPONSE_DAYS } = require('../shared/constants');

const db = admin.firestore();

/**
 * Returns ranked matching suggestions for a user.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getMatchingSuggestions(userId, limit = 10) {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID required' };

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'User not found' };

  const user = userDoc.data();
  const tier = user.subscription_type || SUBSCRIPTION_TIERS.FREE;
  const tierLimits = TIER_LIMITS[tier];

  // Check cache first
  const cacheRef = db.collection('match_cache').doc(userId);
  const cacheDoc = await cacheRef.get();
  const cacheAge = cacheDoc.exists
    ? Date.now() - cacheDoc.data().generated_at?.toMillis()
    : Infinity;

  const CACHE_TTL = tier === SUBSCRIPTION_TIERS.VIP ? 2 * 3600 * 1000 :
                   tier === SUBSCRIPTION_TIERS.PREMIUM ? 6 * 3600 * 1000 :
                   24 * 3600 * 1000;

  if (cacheDoc.exists && cacheAge < CACHE_TTL) {
    const cached = cacheDoc.data().suggestions || [];
    return cached.slice(0, limit);
  }

  // Build candidate pool — only filter by age when the current user has it set
  let query = db.collection('users').limit(500);
  if (user.age) {
    const ageMin = user.age - tierLimits.age_range;
    const ageMax = user.age + tierLimits.age_range;
    query = db.collection('users')
      .where('age', '>=', Math.max(18, ageMin))
      .where('age', '<=', ageMax)
      .limit(500);
  }

  const candidatesSnap = await query.get();

  // Get already-matched user IDs to exclude
  const [existingMatches1, existingMatches2] = await Promise.all([
    db.collection('matches').where('user1_id', '==', userId).get(),
    db.collection('matches').where('user2_id', '==', userId).get(),
  ]);
  const excludedIds = new Set([userId]);
  existingMatches1.docs.forEach(d => excludedIds.add(d.data().user2_id));
  existingMatches2.docs.forEach(d => excludedIds.add(d.data().user1_id));

  // Score candidates
  const suggestions = [];
  for (const doc of candidatesSnap.docs) {
    if (excludedIds.has(doc.id)) continue;
    const candidate = doc.data();

    const score = computeCompatibilityScore(user, candidate, tierLimits);
    if (score >= 0.1) {
      suggestions.push({
        user_id: doc.id,
        username: candidate.username,
        displayName: candidate.displayName,
        age: candidate.age,
        interests: candidate.interests,
        photoURL: candidate.photoURL,
        compatibility_score: Math.round(score * 100) / 100,
      });
    }
  }

  suggestions.sort((a, b) => b.compatibility_score - a.compatibility_score);

  // Cache results
  await cacheRef.set({
    suggestions: suggestions.slice(0, 100),
    generated_at: FieldValue.serverTimestamp(),
    tier,
  });

  return suggestions.slice(0, limit);
}

/**
 * Computes a compatibility score between two users.
 */
function computeCompatibilityScore(user1, user2, tierLimits) {
  // Interest overlap (Jaccard, 50% weight)
  const set1 = new Set(user1.interests || []);
  const set2 = new Set(user2.interests || []);
  const intersection = [...set1].filter(i => set2.has(i)).length;
  const union = new Set([...set1, ...set2]).size;
  const interestScore = union === 0 ? 0 : intersection / union;

  // Distance score (30% weight)
  let distanceScore = 0.5;
  if (user1.location && user2.location) {
    const dist = haversineKm(user1.location, user2.location);
    const maxDist = tierLimits.radius_km;
    distanceScore = Math.max(0, 1 - dist / maxDist);
  }

  // Age compatibility (20% weight)
  let ageScore = 0.5;
  if (user1.age && user2.age) {
    const diff = Math.abs(user1.age - user2.age);
    ageScore = Math.max(0, 1 - diff / 20);
  }

  return interestScore * 0.5 + distanceScore * 0.3 + ageScore * 0.2;
}

function haversineKm(loc1, loc2) {
  const R = 6371;
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.latitude)) * Math.cos(toRad(loc2.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

/**
 * Creates a match record between two users, enforcing rate limits.
 * @param {string} userId
 * @param {string} targetUserId
 * @param {string} matchType
 * @returns {Promise<{ matchId: string }>}
 */
async function createMatch(userId, targetUserId, matchType = MATCH_TYPES.ALGORITHM) {
  if (!userId || !targetUserId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User IDs required' };
  if (userId === targetUserId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'Cannot match with yourself' };

  const limitCheck = await checkSubscriptionLimits(userId, 'matches');
  if (!limitCheck.allowed) {
    throw { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: `Daily match limit reached. Remaining: 0` };
  }

  // Check for existing match
  const existingQuery = await db.collection('matches')
    .where('user1_id', '==', userId)
    .where('user2_id', '==', targetUserId)
    .limit(1).get();
  if (!existingQuery.empty) throw { code: ERROR_CODES.ALREADY_EXISTS, message: 'Match already exists' };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MATCH_EXPIRY_DAYS);

  const matchRef = db.collection('matches').doc();
  await matchRef.set({
    id: matchRef.id,
    user1_id: userId,
    user2_id: targetUserId,
    compatibility_score: 0,
    match_type: matchType,
    status: MATCH_STATUS.PENDING,
    created_at: FieldValue.serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
    updated_at: FieldValue.serverTimestamp(),
  });

  await incrementFeatureUsage(userId, 'matches');
  console.info(`Match created: matchId=${matchRef.id} user1=${userId} user2=${targetUserId}`);
  return { matchId: matchRef.id };
}

/**
 * Accepts or rejects a match. On mutual acceptance, creates a conversation.
 * @param {string} matchId
 * @param {string} userId - The responding user
 * @param {'accept'|'reject'} response
 * @returns {Promise<{ status: string, conversationId?: string }>}
 */
async function respondToMatch(matchId, userId, response) {
  if (!['accept', 'reject'].includes(response)) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Response must be accept or reject' };
  }

  const matchRef = db.collection('matches').doc(matchId);

  return db.runTransaction(async (t) => {
    const matchDoc = await t.get(matchRef);
    if (!matchDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Match not found' };

    const match = matchDoc.data();
    if (match.user1_id !== userId && match.user2_id !== userId) {
      throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Not a participant of this match' };
    }

    if (response === 'reject') {
      t.update(matchRef, { status: MATCH_STATUS.REJECTED, updated_at: FieldValue.serverTimestamp() });
      return { status: MATCH_STATUS.REJECTED };
    }

    // Accept logic
    if (match.status === MATCH_STATUS.PENDING && match.user1_id === userId) {
      t.update(matchRef, { status: MATCH_STATUS.ACCEPTED, updated_at: FieldValue.serverTimestamp() });
      return { status: MATCH_STATUS.ACCEPTED };
    }

    if (match.status === MATCH_STATUS.ACCEPTED && match.user2_id === userId) {
      // Mutual match — create conversation
      const convRef = db.collection('conversations').doc();
      t.set(convRef, {
        id: convRef.id,
        participant1_id: match.user1_id,
        participant2_id: match.user2_id,
        last_message_text: null,
        last_message_timestamp: null,
        unread_count_p1: 0,
        unread_count_p2: 0,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        is_archived: false,
      });
      t.update(matchRef, {
        status: MATCH_STATUS.MUTUAL_MATCH,
        conversation_id: convRef.id,
        updated_at: FieldValue.serverTimestamp(),
      });
      return { status: MATCH_STATUS.MUTUAL_MATCH, conversationId: convRef.id };
    }

    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Invalid match state for this action' };
  });
}

/**
 * Returns paginated match history for a user.
 * @param {string} userId
 * @param {number} limit
 * @param {string|null} startAfter - Last document ID for pagination
 * @returns {Promise<{ matches: Array, nextCursor: string|null }>}
 */
async function getMatchHistory(userId, limit = 20, startAfter = null) {
  let query = db.collection('matches')
    .where('user1_id', '==', userId)
    .orderBy('created_at', 'desc')
    .limit(limit + 1);

  if (startAfter) {
    const cursorDoc = await db.collection('matches').doc(startAfter).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  const docs = snap.docs.slice(0, limit);
  const nextCursor = snap.docs.length > limit ? docs[docs.length - 1].id : null;

  return {
    matches: docs.map(d => d.data()),
    nextCursor,
  };
}

module.exports = { getMatchingSuggestions, createMatch, respondToMatch, getMatchHistory };
