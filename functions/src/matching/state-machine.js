'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();

const MATCH_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  MUTUAL_MATCH: 'mutual_match',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

const VALID_TRANSITIONS = {
  [MATCH_STATUS.PENDING]: [MATCH_STATUS.ACCEPTED, MATCH_STATUS.REJECTED, MATCH_STATUS.EXPIRED],
  [MATCH_STATUS.ACCEPTED]: [MATCH_STATUS.MUTUAL_MATCH, MATCH_STATUS.REJECTED, MATCH_STATUS.EXPIRED],
  [MATCH_STATUS.MUTUAL_MATCH]: [],
  [MATCH_STATUS.REJECTED]: [],
  [MATCH_STATUS.EXPIRED]: [],
};

/**
 * Validates that a status transition is allowed.
 */
function isValidTransition(fromStatus, toStatus) {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * Creates a new match in PENDING state.
 * @param {string} user1Id
 * @param {string} user2Id
 * @param {number} compatibilityScore
 * @param {string} matchType
 * @returns {Promise<{ matchId: string }>}
 */
async function createMatch(user1Id, user2Id, compatibilityScore, matchType = 'algorithm') {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const matchRef = db.collection('matches').doc();
  await matchRef.set({
    id: matchRef.id,
    user1_id: user1Id,
    user2_id: user2Id,
    compatibility_score: compatibilityScore,
    match_type: matchType,
    status: MATCH_STATUS.PENDING,
    created_at: FieldValue.serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
    updated_at: FieldValue.serverTimestamp(),
    history: [{ status: MATCH_STATUS.PENDING, at: Date.now(), by: user1Id }],
  });

  return { matchId: matchRef.id };
}

/**
 * Transitions a match to ACCEPTED state (user1 initiates).
 */
async function acceptMatch(matchId, userId) {
  const matchRef = db.collection('matches').doc(matchId);
  return db.runTransaction(async (t) => {
    const doc = await t.get(matchRef);
    if (!doc.exists) throw new Error('Match not found');
    const match = doc.data();

    if (match.user1_id !== userId) throw new Error('Only user1 can accept in PENDING state');
    if (!isValidTransition(match.status, MATCH_STATUS.ACCEPTED)) {
      throw new Error(`Cannot transition from ${match.status} to ACCEPTED`);
    }

    t.update(matchRef, {
      status: MATCH_STATUS.ACCEPTED,
      updated_at: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion({ status: MATCH_STATUS.ACCEPTED, at: Date.now(), by: userId }),
    });
    return { status: MATCH_STATUS.ACCEPTED };
  });
}

/**
 * Transitions to MUTUAL_MATCH (user2 accepts). Creates conversation automatically.
 */
async function mutualMatch(matchId, userId) {
  const matchRef = db.collection('matches').doc(matchId);
  return db.runTransaction(async (t) => {
    const doc = await t.get(matchRef);
    if (!doc.exists) throw new Error('Match not found');
    const match = doc.data();

    if (match.user2_id !== userId) throw new Error('Only user2 can create mutual match');
    if (!isValidTransition(match.status, MATCH_STATUS.MUTUAL_MATCH)) {
      throw new Error(`Cannot transition from ${match.status} to MUTUAL_MATCH`);
    }

    // Create conversation
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
      mutual_match_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion({ status: MATCH_STATUS.MUTUAL_MATCH, at: Date.now(), by: userId }),
    });

    return { status: MATCH_STATUS.MUTUAL_MATCH, conversationId: convRef.id };
  });
}

/**
 * Rejects a match (either participant can reject at any time).
 */
async function rejectMatch(matchId, userId) {
  const matchRef = db.collection('matches').doc(matchId);
  const doc = await matchRef.get();
  if (!doc.exists) throw new Error('Match not found');
  const match = doc.data();

  if (match.user1_id !== userId && match.user2_id !== userId) {
    throw new Error('Not a participant of this match');
  }
  if (!isValidTransition(match.status, MATCH_STATUS.REJECTED)) {
    throw new Error('Cannot reject at this stage');
  }

  await matchRef.update({
    status: MATCH_STATUS.REJECTED,
    updated_at: FieldValue.serverTimestamp(),
    history: FieldValue.arrayUnion({ status: MATCH_STATUS.REJECTED, at: Date.now(), by: userId }),
  });
  return { status: MATCH_STATUS.REJECTED };
}

/**
 * Expires matches older than 30 days (called by scheduled Cloud Function).
 * @returns {Promise<{ expired: number }>}
 */
async function expireOldMatches() {
  const now = Timestamp.now();
  const staleStatuses = [MATCH_STATUS.PENDING, MATCH_STATUS.ACCEPTED];

  let expired = 0;
  for (const status of staleStatuses) {
    const snap = await db.collection('matches')
      .where('status', '==', status)
      .where('expires_at', '<', now)
      .limit(100)
      .get();

    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: MATCH_STATUS.EXPIRED,
          updated_at: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      expired += snap.size;
    }
  }

  console.info(`Expired ${expired} matches`);
  return { expired };
}

module.exports = {
  MATCH_STATUS,
  isValidTransition,
  createMatch,
  acceptMatch,
  mutualMatch,
  rejectMatch,
  expireOldMatches,
};
