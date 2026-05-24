'use strict';

const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();
const MAX_DEVICES = 5;

/**
 * Generates a device fingerprint hash from client-provided signals.
 * @param {object} signals - { platform, userAgent, screenResolution, timezone }
 * @returns {string}
 */
function generateDeviceFingerprint(signals) {
  const normalized = JSON.stringify({
    platform: signals.platform || 'unknown',
    userAgent: (signals.userAgent || '').substring(0, 200),
    timezone: signals.timezone || 'UTC',
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
}

/**
 * Registers or updates a device for a user.
 * Enforces max device limit (5 devices).
 * @param {string} userId
 * @param {string} deviceId
 * @param {object} deviceInfo
 */
async function registerDevice(userId, deviceId, deviceInfo) {
  const devicesRef = db.collection('users').doc(userId).collection('devices');
  const existing = await devicesRef.get();

  if (existing.size >= MAX_DEVICES && !existing.docs.some(d => d.id === deviceId)) {
    // Remove oldest device
    const oldest = existing.docs.sort((a, b) =>
      (a.data().last_used_at?.toMillis() || 0) - (b.data().last_used_at?.toMillis() || 0)
    )[0];
    await oldest.ref.delete();
  }

  await devicesRef.doc(deviceId).set({
    device_id: deviceId,
    platform: deviceInfo.platform || 'unknown',
    user_agent: deviceInfo.userAgent || '',
    fingerprint: generateDeviceFingerprint(deviceInfo),
    is_trusted: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_used_at: admin.firestore.FieldValue.serverTimestamp(),
    fcm_token: deviceInfo.fcmToken || null,
  }, { merge: true });
}

/**
 * Detects if a login is suspicious (new device/IP not seen before).
 * @param {string} userId
 * @param {string} deviceId
 * @param {string} ip
 * @returns {Promise<{ suspicious: boolean, reason?: string }>}
 */
async function detectSuspiciousLogin(userId, deviceId, ip) {
  const deviceDoc = await db.collection('users').doc(userId)
    .collection('devices').doc(deviceId).get();

  if (!deviceDoc.exists) {
    return { suspicious: true, reason: 'new_device' };
  }

  const device = deviceDoc.data();
  const ipHistory = device.known_ips || [];

  if (ipHistory.length > 0 && !ipHistory.includes(ip)) {
    return { suspicious: true, reason: 'new_ip' };
  }

  return { suspicious: false };
}

/**
 * Removes a specific device (logout from device).
 * @param {string} userId
 * @param {string} deviceId
 */
async function removeDevice(userId, deviceId) {
  await db.collection('users').doc(userId).collection('devices').doc(deviceId).delete();
}

/**
 * Removes all devices for a user (logout from all).
 * @param {string} userId
 */
async function removeAllDevices(userId) {
  const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
  const batch = db.batch();
  devicesSnap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

/**
 * Marks a device as trusted after user confirmation.
 * @param {string} userId
 * @param {string} deviceId
 */
async function trustDevice(userId, deviceId) {
  await db.collection('users').doc(userId).collection('devices').doc(deviceId).update({
    is_trusted: true,
    trusted_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = {
  generateDeviceFingerprint,
  registerDevice,
  detectSuspiciousLogin,
  removeDevice,
  removeAllDevices,
  trustDevice,
};
