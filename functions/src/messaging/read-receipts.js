'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Marks all messages in a conversation as read by a user.
 * Updates both individual message flags and the conversation's unread counter.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<{ updated: number }>}
 */
async function markConversationRead(conversationId, userId) {
  const convRef = db.collection('conversations').doc(conversationId);
  const convDoc = await convRef.get();
  if (!convDoc.exists) throw new Error('Conversation not found');

  const conv = convDoc.data();
  const unreadField = conv.participant1_id === userId ? 'unread_count_p1' : 'unread_count_p2';

  // Get unread messages not sent by this user
  const unreadSnap = await convRef.collection('messages')
    .where('sender_id', '!=', userId)
    .where('is_read', '==', false)
    .where('is_deleted', '==', false)
    .limit(100)
    .get();

  if (!unreadSnap.empty) {
    const batch = db.batch();
    unreadSnap.docs.forEach(doc => batch.update(doc.ref, { is_read: true }));
    batch.update(convRef, { [unreadField]: 0, updated_at: FieldValue.serverTimestamp() });
    await batch.commit();
  } else {
    await convRef.update({ [unreadField]: 0 });
  }

  return { updated: unreadSnap.size };
}

/**
 * Marks a single message as read.
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} userId - Must be the recipient
 */
async function markMessageRead(conversationId, messageId, userId) {
  const msgRef = db.collection('conversations').doc(conversationId)
    .collection('messages').doc(messageId);
  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) throw new Error('Message not found');

  const msg = msgDoc.data();
  if (msg.sender_id === userId) return; // Don't mark own messages as read
  if (msg.is_read) return; // Already read

  await msgRef.update({ is_read: true });
}

/**
 * Gets unread message count per conversation for a user.
 * @param {string} userId
 * @returns {Promise<{ conversationId: string, unreadCount: number }[]>}
 */
async function getUnreadCounts(userId) {
  const [snap1, snap2] = await Promise.all([
    db.collection('conversations')
      .where('participant1_id', '==', userId)
      .where('unread_count_p1', '>', 0)
      .get(),
    db.collection('conversations')
      .where('participant2_id', '==', userId)
      .where('unread_count_p2', '>', 0)
      .get(),
  ]);

  return [
    ...snap1.docs.map(d => ({ conversationId: d.id, unreadCount: d.data().unread_count_p1 })),
    ...snap2.docs.map(d => ({ conversationId: d.id, unreadCount: d.data().unread_count_p2 })),
  ];
}

/**
 * Listens to unread count changes for a user's conversations.
 * CLIENT-SIDE pattern.
 * @param {string} userId
 * @param {function} onUpdate - Called with total unread count
 * @returns {function} unsubscribe
 */
function listenToUnreadCounts(userId, onUpdate) {
  let count1 = 0;
  let count2 = 0;

  const unsub1 = db.collection('conversations')
    .where('participant1_id', '==', userId)
    .onSnapshot(snap => {
      count1 = snap.docs.reduce((sum, d) => sum + (d.data().unread_count_p1 || 0), 0);
      onUpdate(count1 + count2);
    });

  const unsub2 = db.collection('conversations')
    .where('participant2_id', '==', userId)
    .onSnapshot(snap => {
      count2 = snap.docs.reduce((sum, d) => sum + (d.data().unread_count_p2 || 0), 0);
      onUpdate(count1 + count2);
    });

  return () => { unsub1(); unsub2(); };
}

module.exports = {
  markConversationRead,
  markMessageRead,
  getUnreadCounts,
  listenToUnreadCounts,
};
