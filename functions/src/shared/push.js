'use strict';

const https = require('https');

/**
 * Sends push notifications via Expo Push API.
 * Only sends to valid Expo push tokens (ExponentPushToken[...]).
 * @param {string[]} tokens
 * @param {{ title: string, body: string }} notification
 * @param {Record<string, string>} data
 */
async function sendExpoPush(tokens, notification, data = {}) {
  const validTokens = tokens.filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (validTokens.length === 0) return;

  const messages = validTokens.map(to => ({
    to,
    title: notification.title,
    body: notification.body,
    data,
    sound: 'default',
    priority: 'high',
  }));

  const payload = JSON.stringify(messages);

  await new Promise((resolve) => {
    const req = https.request({
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, () => resolve());
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

/**
 * Fetches a user's push tokens and sends a notification.
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} userId
 * @param {{ title: string, body: string }} notification
 * @param {Record<string, string>} data
 */
async function sendPushToUser(db, userId, notification, data = {}) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const tokens = userDoc.data()?.fcm_tokens || [];
    if (tokens.length === 0) return;
    await sendExpoPush(tokens, notification, data);
  } catch (err) {
    console.warn('Push failed for user', userId, err?.message);
  }
}

module.exports = { sendExpoPush, sendPushToUser };
