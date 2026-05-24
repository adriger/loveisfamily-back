'use strict';

/**
 * Offline message queue service for React Native (AsyncStorage-based).
 * Handles message composition, queuing, and sync on reconnect.
 * This module runs CLIENT-SIDE (React Native / mobile app).
 */

// Assumes React Native AsyncStorage is available
let AsyncStorage;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // Fallback for non-RN environments
  AsyncStorage = null;
}

const QUEUE_PREFIX = 'pending_messages_';
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Adds a message to the offline queue for a conversation.
 * @param {string} conversationId
 * @param {object} message - { text, attachments, senderId }
 * @returns {Promise<string>} tempId
 */
async function queueMessage(conversationId, message) {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const key = `${QUEUE_PREFIX}${conversationId}`;

  const existing = await getQueue(conversationId);
  const entry = {
    tempId,
    conversationId,
    text: message.text,
    attachments: message.attachments || [],
    senderId: message.senderId,
    created_at: Date.now(),
    retries: 0,
    status: 'pending',
  };

  await AsyncStorage?.setItem(key, JSON.stringify([...existing, entry]));
  return tempId;
}

/**
 * Gets all queued messages for a conversation.
 * @param {string} conversationId
 * @returns {Promise<Array>}
 */
async function getQueue(conversationId) {
  const key = `${QUEUE_PREFIX}${conversationId}`;
  const raw = await AsyncStorage?.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Removes a message from the queue after successful send.
 * @param {string} conversationId
 * @param {string} tempId
 */
async function dequeueMessage(conversationId, tempId) {
  const key = `${QUEUE_PREFIX}${conversationId}`;
  const queue = await getQueue(conversationId);
  const updated = queue.filter(m => m.tempId !== tempId);
  await AsyncStorage?.setItem(key, JSON.stringify(updated));
}

/**
 * Increments retry count for a failed message.
 * @param {string} conversationId
 * @param {string} tempId
 * @returns {Promise<boolean>} false if max retries reached
 */
async function incrementRetry(conversationId, tempId) {
  const key = `${QUEUE_PREFIX}${conversationId}`;
  const queue = await getQueue(conversationId);
  const msg = queue.find(m => m.tempId === tempId);
  if (!msg) return false;

  if (msg.retries >= MAX_RETRY_ATTEMPTS) {
    msg.status = 'failed';
  } else {
    msg.retries += 1;
    msg.status = 'retrying';
  }

  await AsyncStorage?.setItem(key, JSON.stringify(queue));
  return msg.retries < MAX_RETRY_ATTEMPTS;
}

/**
 * Syncs all pending queued messages on reconnect.
 * @param {string} conversationId
 * @param {function} sendFn - Async function to send a message
 * @returns {Promise<{ sent: number, failed: number }>}
 */
async function syncOnReconnect(conversationId, sendFn) {
  const queue = await getQueue(conversationId);
  const pending = queue.filter(m => m.status === 'pending' || m.status === 'retrying');

  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    try {
      const delay = Math.min(1000 * Math.pow(2, msg.retries), 30000);
      await new Promise(r => setTimeout(r, delay));

      await sendFn(conversationId, msg.senderId, msg.text, msg.attachments);
      await dequeueMessage(conversationId, msg.tempId);
      sent++;
    } catch (err) {
      const canRetry = await incrementRetry(conversationId, msg.tempId);
      if (!canRetry) failed++;
      console.warn(`Failed to sync message ${msg.tempId}: ${err.message}`);
    }
  }

  return { sent, failed };
}

/**
 * Clears the entire queue for a conversation (e.g., on logout).
 * @param {string} conversationId
 */
async function clearQueue(conversationId) {
  await AsyncStorage?.removeItem(`${QUEUE_PREFIX}${conversationId}`);
}

/**
 * Gets all pending messages across all conversations.
 * @returns {Promise<number>} Total pending count
 */
async function getPendingCount() {
  const keys = await AsyncStorage?.getAllKeys() || [];
  const queueKeys = keys.filter(k => k.startsWith(QUEUE_PREFIX));
  let total = 0;
  for (const key of queueKeys) {
    const raw = await AsyncStorage?.getItem(key);
    const queue = raw ? JSON.parse(raw) : [];
    total += queue.filter(m => m.status === 'pending').length;
  }
  return total;
}

module.exports = {
  queueMessage,
  getQueue,
  dequeueMessage,
  incrementRetry,
  syncOnReconnect,
  clearQueue,
  getPendingCount,
};
