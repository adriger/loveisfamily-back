'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Logs when suggestions are shown to a user (for CTR calculation).
 * @param {string} userId
 * @param {string[]} suggestedUserIds
 */
async function logSuggestionViews(userId, suggestedUserIds) {
  const batch = db.batch();
  for (const targetId of suggestedUserIds) {
    const ref = db.collection('match_events').doc();
    batch.set(ref, {
      type: 'suggestion_viewed',
      user_id: userId,
      target_user_id: targetId,
      timestamp: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * Logs a match acceptance event.
 * @param {string} matchId
 * @param {string} userId
 * @param {string} targetUserId
 * @param {number} compatibilityScore
 */
async function logMatchAcceptance(matchId, userId, targetUserId, compatibilityScore) {
  await db.collection('match_events').add({
    type: 'match_accepted',
    match_id: matchId,
    user_id: userId,
    target_user_id: targetUserId,
    compatibility_score: compatibilityScore,
    timestamp: FieldValue.serverTimestamp(),
  });
}

/**
 * Logs a match rejection for preference learning.
 */
async function logMatchRejection(matchId, userId, targetUserId) {
  await db.collection('match_events').add({
    type: 'match_rejected',
    match_id: matchId,
    user_id: userId,
    target_user_id: targetUserId,
    timestamp: FieldValue.serverTimestamp(),
  });
}

/**
 * Logs a mutual match with quality signal (did they message within 48h?).
 */
async function logMutualMatch(matchId, user1Id, user2Id, conversationId) {
  await db.collection('match_events').add({
    type: 'mutual_match',
    match_id: matchId,
    user1_id: user1Id,
    user2_id: user2Id,
    conversation_id: conversationId,
    messaged_within_48h: false, // Updated by a trigger when first message sent
    timestamp: FieldValue.serverTimestamp(),
  });
}

/**
 * Calculates CTR (click-through rate) for the last N days.
 * CTR = (matches created / suggestions viewed) * 100
 * @param {number} days
 * @returns {Promise<{ ctr: number, views: number, matches: number }>}
 */
async function calculateCTR(days = 7) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const sinceTs = Timestamp.fromDate(since);

  const [views, accepted] = await Promise.all([
    db.collection('match_events').where('type', '==', 'suggestion_viewed').where('timestamp', '>=', sinceTs).get(),
    db.collection('match_events').where('type', '==', 'match_accepted').where('timestamp', '>=', sinceTs).get(),
  ]);

  const ctr = views.size > 0 ? (accepted.size / views.size) * 100 : 0;
  return { ctr: Math.round(ctr * 100) / 100, views: views.size, matches: accepted.size };
}

/**
 * Calculates match quality (% of mutual matches that led to conversation).
 * @param {number} days
 */
async function calculateMatchQuality(days = 7) {
  const since = Timestamp.fromDate(new Date(Date.now() - days * 24 * 3600 * 1000));
  const mutual = await db.collection('match_events')
    .where('type', '==', 'mutual_match').where('timestamp', '>=', since).get();

  const withMessages = mutual.docs.filter(d => d.data().messaged_within_48h === true).length;
  const quality = mutual.size > 0 ? (withMessages / mutual.size) * 100 : 0;

  return { quality: Math.round(quality * 100) / 100, total: mutual.size, with_messages: withMessages };
}

module.exports = {
  logSuggestionViews,
  logMatchAcceptance,
  logMatchRejection,
  logMutualMatch,
  calculateCTR,
  calculateMatchQuality,
};
