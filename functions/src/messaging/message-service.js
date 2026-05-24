'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();
const MAX_MESSAGE_LENGTH = 5000;
const MAX_REACTIONS = 10;
const EDIT_WINDOW_HOURS = 24;
const MESSAGES_PER_PAGE = 50;

/**
 * Attaches a real-time listener to messages in a conversation.
 * CLIENT-SIDE pattern.
 * @param {string} conversationId
 * @param {function} onMessages
 * @param {function} onError
 * @param {number} limit
 * @returns {function} unsubscribe
 */
function listenToMessages(conversationId, onMessages, onError, limit = MESSAGES_PER_PAGE) {
  return db.collection('conversations').doc(conversationId)
    .collection('messages')
    .where('is_deleted', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .onSnapshot(
      snap => onMessages(snap.docs.map(d => d.data()).reverse()),
      onError
    );
}

/**
 * Loads the previous page of messages (infinite scroll upward).
 * @param {string} conversationId
 * @param {string} oldestMessageId - ID of oldest currently displayed message
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function loadPreviousMessages(conversationId, oldestMessageId, limit = MESSAGES_PER_PAGE) {
  const cursorDoc = await db.collection('conversations').doc(conversationId)
    .collection('messages').doc(oldestMessageId).get();

  if (!cursorDoc.exists) return [];

  const snap = await db.collection('conversations').doc(conversationId)
    .collection('messages')
    .where('is_deleted', '==', false)
    .orderBy('timestamp', 'desc')
    .startAfter(cursorDoc)
    .limit(limit)
    .get();

  return snap.docs.map(d => d.data()).reverse();
}

/**
 * Sends a message with transaction — updates conversation metadata atomically.
 * SERVER-SIDE function.
 * @returns {Promise<{ messageId: string }>}
 */
async function sendMessage(conversationId, senderId, text, attachments = []) {
  if (!text?.trim() && attachments.length === 0) {
    throw new Error('Message cannot be empty');
  }
  if (text && text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`);
  }

  const convRef = db.collection('conversations').doc(conversationId);
  const msgRef = convRef.collection('messages').doc();

  await db.runTransaction(async (t) => {
    const convDoc = await t.get(convRef);
    if (!convDoc.exists) throw new Error('Conversation not found');

    const conv = convDoc.data();
    const isP1 = conv.participant1_id === senderId;
    const recipientUnreadField = isP1 ? 'unread_count_p2' : 'unread_count_p1';

    t.set(msgRef, {
      id: msgRef.id,
      sender_id: senderId,
      text: (text || '').trim(),
      timestamp: FieldValue.serverTimestamp(),
      is_read: false,
      attachments: (attachments || []).slice(0, 10),
      is_edited: false,
      edited_at: null,
      is_deleted: false,
      reactions: {},
      encryption_key_index: 0,
    });

    t.update(convRef, {
      last_message_text: (text || '').trim().substring(0, 100),
      last_message_timestamp: FieldValue.serverTimestamp(),
      [recipientUnreadField]: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });
  });

  return { messageId: msgRef.id };
}

/**
 * Edits a message within the 24-hour edit window.
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} userId
 * @param {string} newText
 */
async function editMessage(conversationId, messageId, userId, newText) {
  if (!newText?.trim()) throw new Error('New text required');

  const msgRef = db.collection('conversations').doc(conversationId)
    .collection('messages').doc(messageId);
  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) throw new Error('Message not found');

  const msg = msgDoc.data();
  if (msg.sender_id !== userId) throw new Error('Cannot edit another user\'s message');
  if (msg.is_read) throw new Error('Cannot edit a message that has been read');

  const createdMs = msg.timestamp?.toMillis() || 0;
  if (Date.now() - createdMs > EDIT_WINDOW_HOURS * 3600 * 1000) {
    throw new Error('Edit window expired (24 hours)');
  }

  await msgRef.update({
    text: newText.trim(),
    is_edited: true,
    edited_at: FieldValue.serverTimestamp(),
  });
}

/**
 * Soft-deletes a message.
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} userId
 * @param {'self'|'both'} scope
 */
async function deleteMessage(conversationId, messageId, userId, scope = 'both') {
  const msgRef = db.collection('conversations').doc(conversationId)
    .collection('messages').doc(messageId);
  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) throw new Error('Message not found');
  if (msgDoc.data().sender_id !== userId) throw new Error('Permission denied');

  await msgRef.update({
    is_deleted: true,
    deleted_at: FieldValue.serverTimestamp(),
    text: '[Message deleted]',
    attachments: [],
    delete_scope: scope,
  });
}

/**
 * Adds or removes an emoji reaction on a message.
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} userId
 * @param {string} emoji
 */
async function toggleReaction(conversationId, messageId, userId, emoji) {
  const msgRef = db.collection('conversations').doc(conversationId)
    .collection('messages').doc(messageId);

  await db.runTransaction(async (t) => {
    const msgDoc = await t.get(msgRef);
    if (!msgDoc.exists) throw new Error('Message not found');

    const reactions = msgDoc.data().reactions || {};
    const currentUsers = reactions[emoji] || [];

    if (currentUsers.length === 0 && Object.keys(reactions).length >= MAX_REACTIONS) {
      throw new Error('Maximum reactions per message reached');
    }

    const userIndex = currentUsers.indexOf(userId);
    let updatedUsers;
    if (userIndex >= 0) {
      updatedUsers = currentUsers.filter(u => u !== userId);
    } else {
      updatedUsers = [...currentUsers, userId];
    }

    const updatedReactions = { ...reactions };
    if (updatedUsers.length === 0) {
      delete updatedReactions[emoji];
    } else {
      updatedReactions[emoji] = updatedUsers;
    }

    t.update(msgRef, { reactions: updatedReactions });
  });
}

module.exports = {
  listenToMessages,
  loadPreviousMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
};
