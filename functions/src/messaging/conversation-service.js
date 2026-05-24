'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Attaches a Firestore real-time listener to the user's conversation list.
 * Returns an unsubscribe function.
 * CLIENT-SIDE usage pattern (React Native / Web SDK).
 *
 * @param {string} userId
 * @param {function} onUpdate - Called with array of conversation objects
 * @param {function} onError
 * @returns {function} unsubscribe
 */
function listenToConversations(userId, onUpdate, onError) {
  const query1 = db.collection('conversations')
    .where('participant1_id', '==', userId)
    .where('is_archived', '==', false)
    .orderBy('last_message_timestamp', 'desc')
    .limit(50);

  const query2 = db.collection('conversations')
    .where('participant2_id', '==', userId)
    .where('is_archived', '==', false)
    .orderBy('last_message_timestamp', 'desc')
    .limit(50);

  let results1 = [];
  let results2 = [];

  function merge() {
    const all = [...results1, ...results2]
      .sort((a, b) => (b.last_message_timestamp?.toMillis() || 0) - (a.last_message_timestamp?.toMillis() || 0))
      .slice(0, 50);
    onUpdate(all);
  }

  const unsub1 = query1.onSnapshot(snap => {
    results1 = snap.docs.map(d => d.data());
    merge();
  }, onError);

  const unsub2 = query2.onSnapshot(snap => {
    results2 = snap.docs.map(d => d.data());
    merge();
  }, onError);

  return () => { unsub1(); unsub2(); };
}

/**
 * Gets a conversation between two users, or creates one if it doesn't exist.
 * @param {string} userId1
 * @param {string} userId2
 * @returns {Promise<{ conversationId: string, created: boolean }>}
 */
async function getOrCreateConversation(userId1, userId2) {
  // Check if conversation already exists
  const existing = await db.collection('conversations')
    .where('participant1_id', '==', userId1)
    .where('participant2_id', '==', userId2)
    .limit(1).get();

  if (!existing.empty) {
    return { conversationId: existing.docs[0].id, created: false };
  }

  // Check reverse
  const existingReverse = await db.collection('conversations')
    .where('participant1_id', '==', userId2)
    .where('participant2_id', '==', userId1)
    .limit(1).get();

  if (!existingReverse.empty) {
    return { conversationId: existingReverse.docs[0].id, created: false };
  }

  const convRef = db.collection('conversations').doc();
  await convRef.set({
    id: convRef.id,
    participant1_id: userId1,
    participant2_id: userId2,
    last_message_text: null,
    last_message_timestamp: null,
    unread_count_p1: 0,
    unread_count_p2: 0,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    is_archived: false,
  });

  return { conversationId: convRef.id, created: true };
}

/**
 * Archives a conversation for a user.
 * @param {string} conversationId
 * @param {string} userId
 */
async function archiveConversation(conversationId, userId) {
  const convDoc = await db.collection('conversations').doc(conversationId).get();
  if (!convDoc.exists) throw new Error('Conversation not found');
  const conv = convDoc.data();
  if (conv.participant1_id !== userId && conv.participant2_id !== userId) {
    throw new Error('Permission denied');
  }
  await convDoc.ref.update({ is_archived: true, updated_at: FieldValue.serverTimestamp() });
}

/**
 * Updates the conversation index (denormalized) for fast inbox queries.
 * Called after each message send.
 * @param {string} conversationId
 * @param {string} lastMessageText
 * @param {Timestamp} lastMessageTimestamp
 * @param {string} recipientId
 */
async function updateConversationIndex(conversationId, lastMessageText, lastMessageTimestamp, recipientId) {
  const convRef = db.collection('conversations').doc(conversationId);
  await convRef.update({
    last_message_text: lastMessageText.substring(0, 100),
    last_message_timestamp: lastMessageTimestamp,
    updated_at: FieldValue.serverTimestamp(),
  });
}

module.exports = {
  listenToConversations,
  getOrCreateConversation,
  archiveConversation,
  updateConversationIndex,
};
