'use strict';

const admin = require('firebase-admin');

const db = admin.firestore();

const ALERT_THRESHOLDS = {
  failed_logins: 5,
  bulk_reads: 1000,
  rate_limit_hits: 50,
};

/**
 * Logs an authentication event.
 * @param {object} event
 */
async function logAuthEvent({ userId, action, ip, deviceId, result, metadata = {} }) {
  const entry = {
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    user_id: userId || 'anonymous',
    action,
    ip: ip || 'unknown',
    device_id: deviceId || 'unknown',
    result,
    metadata,
    category: 'auth',
  };

  await db.collection('audit_logs').add(entry);

  // Check for suspicious patterns
  if (action === 'login_failed' && result === 'failure') {
    await checkFailedLoginAlert(userId, ip);
  }
}

/**
 * Logs a sensitive data operation.
 * @param {object} event
 */
async function logSensitiveOperation({ userId, action, resourceType, resourceId, ip, result }) {
  await db.collection('audit_logs').add({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    ip: ip || 'unknown',
    result,
    category: 'sensitive_operation',
  });
}

/**
 * Logs a security check failure.
 * @param {object} event
 */
async function logSecurityEvent({ userId, event, ip, severity = 'medium', metadata = {} }) {
  const entry = {
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    user_id: userId || 'unknown',
    event,
    ip: ip || 'unknown',
    severity,
    metadata,
    category: 'security',
  };

  await db.collection('audit_logs').add(entry);

  if (severity === 'high' || severity === 'critical') {
    await triggerAlert({ type: 'security_event', userId, event, severity });
  }
}

/**
 * Logs a rate limit hit.
 */
async function logRateLimitHit({ userId, feature, ip }) {
  await db.collection('audit_logs').add({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    user_id: userId,
    action: 'rate_limit_exceeded',
    feature,
    ip,
    category: 'rate_limit',
  });
}

/**
 * Checks if failed login count exceeds threshold and triggers alert.
 */
async function checkFailedLoginAlert(userId, ip) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentFailures = await db.collection('audit_logs')
    .where('category', '==', 'auth')
    .where('action', '==', 'login_failed')
    .where('user_id', '==', userId)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(fiveMinAgo))
    .get();

  if (recentFailures.size >= ALERT_THRESHOLDS.failed_logins) {
    await triggerAlert({
      type: 'multiple_failed_logins',
      userId,
      ip,
      count: recentFailures.size,
      severity: 'high',
    });
  }
}

/**
 * Triggers an alert (writes to alerts collection; integrate with PagerDuty/Slack).
 */
async function triggerAlert({ type, userId, severity = 'medium', ...metadata }) {
  await db.collection('security_alerts').add({
    type,
    user_id: userId,
    severity,
    metadata,
    triggered_at: admin.firestore.FieldValue.serverTimestamp(),
    resolved: false,
  });

  console.warn(`SECURITY ALERT: type=${type} userId=${userId} severity=${severity}`);
}

/**
 * Scheduled cleanup — removes audit logs older than 90 days.
 * Call from a scheduled Cloud Function.
 */
async function cleanupOldLogs() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const old = await db.collection('audit_logs')
    .where('timestamp', '<', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
    .limit(500).get();

  if (!old.empty) {
    const batch = db.batch();
    old.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.info(`Audit log cleanup: deleted ${old.size} entries`);
  }
}

module.exports = {
  logAuthEvent,
  logSensitiveOperation,
  logSecurityEvent,
  logRateLimitHit,
  triggerAlert,
  cleanupOldLogs,
};
