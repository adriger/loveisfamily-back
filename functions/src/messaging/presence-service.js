'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();
const PRESENCE_STALE_MINUTES = 5;
const TYPING_TTL_MS = 5000;

/**
 * Sets a user as online (called on app foreground).
 * @param {string} userId
 */
async function setOnline(userId) {
  await db.collection('presence').doc(userId).set({
    user_id: userId,
    is_online: true,
    last_seen: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Sets a user as offline (called on app background/logout).
 * @param {string} userId
 */
async function setOffline(userId) {
  await db.collection('presence').doc(userId).set({
    user_id: userId,
    is_online: false,
    last_seen: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Listens to another user's presence status.
 * CLIENT-SIDE pattern.
 * @param {string} targetUserId
 * @param {function} onPresence
 * @returns {function} unsubscribe
 */
function listenToPresence(targetUserId, onPresence) {
  return db.collection('presence').doc(targetUserId)
    .onSnapshot(snap => {
      if (!snap.exists) {
        onPresence({ is_online: false, last_seen: null });
        return;
      }
      const data = snap.data();
      // Consider stale if last update was > 5 minutes ago
      const lastUpdated = data.updated_at?.toMillis() || 0;
      const isStale = Date.now() - lastUpdated > PRESENCE_STALE_MINUTES * 60 * 1000;
      onPresence({
        is_online: isStale ? false : data.is_online,
        last_seen: data.last_seen,
      });
    });
}

/**
 * Sets typing indicator for a user in a conversation.
 * @param {string} conversationId
 * @param {string} userId
 */
async function setTyping(conversationId, userId) {
  await db.collection('conversations').doc(conversationId)
    .collection('typing_indicators').doc(userId).set({
      user_id: userId,
      started_at: FieldValue.serverTimestamp(),
      expires_at: Timestamp.fromMillis(Date.now() + TYPING_TTL_MS),
    });
}

/**
 * Clears typing indicator (on send or blur).
 * @param {string} conversationId
 * @param {string} userId
 */
async function clearTyping(conversationId, userId) {
  await db.collection('conversations').doc(conversationId)
    .collection('typing_indicators').doc(userId).delete();
}

/**
 * Listens to typing indicators in a conversation.
 * CLIENT-SIDE pattern.
 * @param {string} conversationId
 * @param {string} currentUserId - Exclude self
 * @param {function} onTyping - Called with boolean
 * @returns {function} unsubscribe
 */
function listenToTyping(conversationId, currentUserId, onTyping) {
  return db.collection('conversations').doc(conversationId)
    .collection('typing_indicators')
    .onSnapshot(snap => {
      const now = Date.now();
      const othersTyping = snap.docs.some(doc => {
        const data = doc.data();
        return doc.id !== currentUserId && data.expires_at?.toMillis() > now;
      });
      onTyping(othersTyping);
    });
}

/**
 * Scheduled function — cleans up stale presence and typing indicators.
 * Call every 5 minutes via Cloud Scheduler.
 */
async function cleanupStalePresence() {
  const staleThreshold = new Date(Date.now() - PRESENCE_STALE_MINUTES * 60 * 1000);

  const stalePresence = await db.collection('presence')
    .where('is_online', '==', true)
    .where('updated_at', '<', Timestamp.fromDate(staleThreshold))
    .get();

  if (!stalePresence.empty) {
    const batch = db.batch();
    stalePresence.docs.forEach(doc => {
      batch.update(doc.ref, { is_online: false });
    });
    await batch.commit();
    console.info(`Cleaned up ${stalePresence.size} stale presence records`);
  }
}

module.exports = {
  setOnline,
  setOffline,
  listenToPresence,
  setTyping,
  clearTyping,
  listenToTyping,
  cleanupStalePresence,
};
