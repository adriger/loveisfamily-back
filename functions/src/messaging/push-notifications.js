'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');

const db = admin.firestore();
const messaging = admin.messaging();

const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'new_message',
  MATCH_FOUND: 'match_found',
  TEAM_INVITE: 'team_invite',
  POST_LIKE: 'post_like',
  POST_COMMENT: 'post_comment',
};

/**
 * Checks if a user has opted in to a notification type, respecting quiet hours.
 * @param {string} userId
 * @param {string} type
 * @returns {Promise<boolean>}
 */
async function canSendNotification(userId, type) {
  const settingsSnap = await db.collection('users').doc(userId)
    .collection('notification_settings').limit(1).get();

  if (settingsSnap.empty) return true;
  const settings = settingsSnap.docs[0].data();

  const typeMap = {
    [NOTIFICATION_TYPES.NEW_MESSAGE]: settings.messages_enabled !== false,
    [NOTIFICATION_TYPES.MATCH_FOUND]: settings.matches_enabled !== false,
    [NOTIFICATION_TYPES.TEAM_INVITE]: settings.teams_enabled !== false,
    [NOTIFICATION_TYPES.POST_LIKE]: settings.likes_enabled !== false,
    [NOTIFICATION_TYPES.POST_COMMENT]: settings.likes_enabled !== false,
  };

  if (!typeMap[type]) return false;

  // Check quiet hours
  const now = new Date();
  const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
  const start = settings.quiet_hours_start || '22:00';
  const end = settings.quiet_hours_end || '08:00';

  if (start < end) {
    return !(currentTime >= start && currentTime < end);
  } else {
    // Overnight quiet hours
    return !(currentTime >= start || currentTime < end);
  }
}

/**
 * Gets all active FCM tokens for a user.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getUserTokens(userId) {
  const devicesSnap = await db.collection('users').doc(userId)
    .collection('devices').get();
  return devicesSnap.docs
    .map(d => d.data().fcm_token)
    .filter(Boolean);
}

/**
 * Sends a push notification to all user devices.
 * @param {string} userId
 * @param {object} notification - { title, body }
 * @param {object} data - Extra payload
 * @param {string} type
 */
async function sendToUser(userId, notification, data, type) {
  const canSend = await canSendNotification(userId, type);
  if (!canSend) return { sent: false, reason: 'notifications_disabled_or_quiet_hours' };

  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) return { sent: false, reason: 'no_tokens' };

  const message = {
    notification: {
      title: notification.title,
      body: notification.body.substring(0, 150),
    },
    data: { ...data, notification_type: type },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };

  const results = await Promise.allSettled(
    tokens.map(token => messaging.send({ ...message, token }))
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`Failed to send to ${failed.length}/${tokens.length} tokens for user ${userId}`);
  }

  return { sent: true, delivered: results.length - failed.length, total: results.length };
}

/**
 * Sends a new message notification.
 * @param {string} conversationId
 * @param {string} messageId
 * @param {string} senderId
 * @param {string} recipientId
 * @param {string} messageText
 * @param {string} senderName
 */
async function sendMessageNotification(conversationId, messageId, senderId, recipientId, messageText, senderName) {
  return sendToUser(
    recipientId,
    { title: `New message from ${senderName}`, body: messageText.substring(0, 80) },
    { conversationId, messageId, senderId },
    NOTIFICATION_TYPES.NEW_MESSAGE
  );
}

/**
 * Sends a match notification.
 */
async function sendMatchNotification(matchId, targetUserId, matcherName) {
  return sendToUser(
    targetUserId,
    { title: `You matched with ${matcherName}!`, body: 'Start a conversation now' },
    { matchId },
    NOTIFICATION_TYPES.MATCH_FOUND
  );
}

/**
 * Sends a team invitation notification.
 */
async function sendTeamInviteNotification(teamId, invitedUserId, inviterName, teamName) {
  return sendToUser(
    invitedUserId,
    { title: `${inviterName} invited you to team ${teamName}`, body: 'Join to collaborate on activities' },
    { teamId, inviterName, teamName },
    NOTIFICATION_TYPES.TEAM_INVITE
  );
}

/**
 * Cleans up expired FCM tokens (devices inactive > 30 days).
 * Call via scheduled Cloud Function.
 */
async function cleanupExpiredTokens() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const usersSnap = await db.collection('users').limit(100).get();

  for (const userDoc of usersSnap.docs) {
    const devicesSnap = await userDoc.ref.collection('devices')
      .where('last_used_at', '<', Timestamp.fromDate(thirtyDaysAgo))
      .get();

    if (!devicesSnap.empty) {
      const batch = db.batch();
      devicesSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }
}

module.exports = {
  NOTIFICATION_TYPES,
  sendToUser,
  sendMessageNotification,
  sendMatchNotification,
  sendTeamInviteNotification,
  cleanupExpiredTokens,
  canSendNotification,
};
