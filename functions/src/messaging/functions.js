'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');
const { validateText, validateAttachments } = require('../shared/validators');
const { ERROR_CODES, PAGINATION, MESSAGE_EDIT_HOURS } = require('../shared/constants');

const db = admin.firestore();

/**
 * Creates a message in a conversation and updates conversation metadata.
 * @param {string} conversationId
 * @param {string} senderId
 * @param {string} text
 * @param {Array} attachments
 * @returns {Promise<{ messageId: string }>}
 */
async function sendMessage(conversationId, senderId, text, attachments = []) {
  if (!conversationId || !senderId) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'conversationId and senderId are required' };
  }

  const textResult = validateText(text, 5000);
  if (!textResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: textResult.error };

  const attResult = validateAttachments(attachments);
  if (!attResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: attResult.error };

  const convRef = db.collection('conversations').doc(conversationId);
  const convDoc = await convRef.get();
  if (!convDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Conversation not found' };

  const conv = convDoc.data();
  if (conv.participant1_id !== senderId && conv.participant2_id !== senderId) {
    throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Not a participant of this conversation' };
  }

  const recipientUnreadField = conv.participant1_id === senderId ? 'unread_count_p2' : 'unread_count_p1';
  const msgRef = convRef.collection('messages').doc();

  await db.runTransaction(async (t) => {
    t.set(msgRef, {
      id: msgRef.id,
      sender_id: senderId,
      text: text.trim(),
      timestamp: FieldValue.serverTimestamp(),
      is_read: false,
      attachments,
      is_edited: false,
      edited_at: null,
      is_deleted: false,
      reactions: {},
      encryption_key_index: 0,
    });

    t.update(convRef, {
      last_message_text: text.trim().substring(0, 100),
      last_message_timestamp: FieldValue.serverTimestamp(),
      [recipientUnreadField]: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });
  });

  try {
    const recipientId = conv.participant1_id === senderId ? conv.participant2_id : conv.participant1_id;
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    const recipientData = recipientDoc.data();
    const tokens = recipientData?.fcm_tokens || [];

    if (tokens.length > 0) {
      const senderDoc = await db.collection('users').doc(senderId).get();
      const senderName = senderDoc.data()?.displayName || 'Alguien';

      const notification = {
        title: senderName,
        body: text.length > 100 ? text.slice(0, 97) + '...' : text,
      };

      const messaging = admin.messaging();
      await Promise.allSettled(
        tokens.map(token => messaging.send({
          token,
          notification,
          data: { conversationId, type: 'new_message' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        }))
      );
    }
  } catch (pushErr) {
    console.warn('Push notification failed:', pushErr.message);
  }

  return { messageId: msgRef.id };
}

/**
 * Returns all conversations for a user, ordered by last message.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getConversations(userId) {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID required' };

  const [snap1, snap2] = await Promise.all([
    db.collection('conversations')
      .where('participant1_id', '==', userId)
      .where('is_archived', '==', false)
      .orderBy('last_message_timestamp', 'desc')
      .limit(50).get(),
    db.collection('conversations')
      .where('participant2_id', '==', userId)
      .where('is_archived', '==', false)
      .orderBy('last_message_timestamp', 'desc')
      .limit(50).get(),
  ]);

  const conversations = [...snap1.docs, ...snap2.docs]
    .map(d => d.data())
    .sort((a, b) => (b.last_message_timestamp?.toMillis() || 0) - (a.last_message_timestamp?.toMillis() || 0))
    .slice(0, 50);

  return conversations;
}

/**
 * Returns paginated messages for a conversation.
 * @param {string} conversationId
 * @param {string} userId - Must be a participant
 * @param {number} limit
 * @param {string|null} startAfter - Message ID for pagination cursor
 * @returns {Promise<{ messages: Array, nextCursor: string|null }>}
 */
async function getMessages(conversationId, userId, limit = PAGINATION.MESSAGES_LIMIT, startAfter = null) {
  const convDoc = await db.collection('conversations').doc(conversationId).get();
  if (!convDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Conversation not found' };

  const conv = convDoc.data();
  if (conv.participant1_id !== userId && conv.participant2_id !== userId) {
    throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Not a participant of this conversation' };
  }

  let query = db.collection('conversations').doc(conversationId)
    .collection('messages')
    .where('is_deleted', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(limit + 1);

  if (startAfter) {
    const cursorDoc = await db.collection('conversations').doc(conversationId)
      .collection('messages').doc(startAfter).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  const docs = snap.docs.slice(0, limit);
  const nextCursor = snap.docs.length > limit ? docs[docs.length - 1].id : null;

  return {
    messages: docs.map(d => d.data()).reverse(),
    nextCursor,
  };
}

/**
 * Marks all messages in a conversation as read for a user.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function markAsRead(conversationId, userId) {
  const convRef = db.collection('conversations').doc(conversationId);
  const convDoc = await convRef.get();
  if (!convDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Conversation not found' };

  const conv = convDoc.data();
  const unreadField = conv.participant1_id === userId ? 'unread_count_p1' : 'unread_count_p2';
  await convRef.update({ [unreadField]: 0, updated_at: FieldValue.serverTimestamp() });

  // Mark individual messages as read
  const unreadMessages = await convRef.collection('messages')
    .where('sender_id', '!=', userId)
    .where('is_read', '==', false)
    .limit(100).get();

  if (!unreadMessages.empty) {
    const batch = db.batch();
    unreadMessages.docs.forEach(doc => batch.update(doc.ref, { is_read: true }));
    await batch.commit();
  }
}

/**
 * Soft-deletes a message (only visible to sender, hidden for all).
 * @param {string} messageId
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteMessage(messageId, conversationId, userId) {
  const msgRef = db.collection('conversations').doc(conversationId)
    .collection('messages').doc(messageId);
  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Message not found' };

  const msg = msgDoc.data();
  if (msg.sender_id !== userId) {
    throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Can only delete your own messages' };
  }

  await msgRef.update({
    is_deleted: true,
    deleted_at: FieldValue.serverTimestamp(),
    text: '[Message deleted]',
  });
}

async function registerPushToken(userId, token, platform) {
  if (!token) throw { code: ERROR_CODES.INVALID_INPUT, message: 'Token required' };

  await db.collection('users').doc(userId).update({
    fcm_tokens: FieldValue.arrayUnion(token),
    [`fcm_token_${platform}`]: token,
    updated_at: FieldValue.serverTimestamp(),
  });

  return { success: true };
}

module.exports = { sendMessage, getConversations, getMessages, markAsRead, deleteMessage, registerPushToken };
