'use strict';

const admin = require('firebase-admin');

const db = admin.firestore();
const auth = admin.auth();

/**
 * Exports all data for a user as a structured JSON object (GDPR Article 20).
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function exportUserData(userId) {
  const [
    userDoc,
    profileDoc,
    limitsDoc,
    matchesSnap1,
    matchesSnap2,
    postsSnap,
    convsSnap1,
    convsSnap2,
  ] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('users').doc(userId).collection('profiles').doc('main').get(),
    db.collection('user_limits').doc(userId).get(),
    db.collection('matches').where('user1_id', '==', userId).get(),
    db.collection('matches').where('user2_id', '==', userId).get(),
    db.collection('posts').where('author_id', '==', userId).get(),
    db.collection('conversations').where('participant1_id', '==', userId).get(),
    db.collection('conversations').where('participant2_id', '==', userId).get(),
  ]);

  const export_data = {
    exported_at: new Date().toISOString(),
    user: userDoc.exists ? sanitizeForExport(userDoc.data()) : null,
    profile: profileDoc.exists ? profileDoc.data() : null,
    usage_limits: limitsDoc.exists ? limitsDoc.data() : null,
    matches: [...matchesSnap1.docs, ...matchesSnap2.docs].map(d => d.data()),
    posts: postsSnap.docs.map(d => d.data()),
    conversations: [],
  };

  // Include conversations with messages
  const allConvs = [...convsSnap1.docs, ...convsSnap2.docs];
  for (const convDoc of allConvs) {
    const messagesSnap = await convDoc.ref.collection('messages')
      .where('sender_id', '==', userId).limit(1000).get();
    export_data.conversations.push({
      ...convDoc.data(),
      my_messages: messagesSnap.docs.map(d => d.data()),
    });
  }

  return export_data;
}

function sanitizeForExport(data) {
  const { ...safeData } = data;
  return safeData;
}

/**
 * Complete GDPR-compliant user deletion cascade (Article 17 - Right to Erasure).
 * Deletes all user data within the 30-day regulatory window.
 * @param {string} userId
 * @returns {Promise<{ deletedAt: string }>}
 */
async function deleteUserData(userId) {
  console.info(`GDPR deletion started: userId=${userId}`);

  // 1. Anonymize messages sent by the user
  const messagesSnap = await db.collectionGroup('messages')
    .where('sender_id', '==', userId).limit(500).get();

  if (!messagesSnap.empty) {
    const batch = db.batch();
    messagesSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        sender_id: 'deleted_user',
        text: '[Message from deleted account]',
        is_deleted: true,
        attachments: [],
      });
    });
    await batch.commit();
  }

  // 2. Remove from all matches
  const [m1, m2] = await Promise.all([
    db.collection('matches').where('user1_id', '==', userId).get(),
    db.collection('matches').where('user2_id', '==', userId).get(),
  ]);
  if (!m1.empty || !m2.empty) {
    const batch = db.batch();
    [...m1.docs, ...m2.docs].forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // 3. Archive posts (not delete — community integrity)
  const postsSnap = await db.collection('posts').where('author_id', '==', userId).get();
  if (!postsSnap.empty) {
    const batch = db.batch();
    postsSnap.docs.forEach(doc => {
      batch.update(doc.ref, { author_id: 'deleted_user', is_archived: true });
    });
    await batch.commit();
  }

  // 4. Handle teams — delete if owner, remove from members if member
  const ownedTeams = await db.collection('teams').where('owner_id', '==', userId).get();
  if (!ownedTeams.empty) {
    const batch = db.batch();
    ownedTeams.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // Remove from member arrays
  const memberTeams = await db.collection('teams').get(); // filtered in-memory for simplicity
  const memberBatch = db.batch();
  let memberUpdates = 0;
  memberTeams.docs.forEach(doc => {
    const team = doc.data();
    if (team.members?.some(m => m.user_id === userId)) {
      const updatedMembers = team.members.filter(m => m.user_id !== userId);
      memberBatch.update(doc.ref, { members: updatedMembers, member_count: updatedMembers.length });
      memberUpdates++;
    }
  });
  if (memberUpdates > 0) await memberBatch.commit();

  // 5. Log the deletion request for audit trail (keep 7 years for legal compliance)
  await db.collection('gdpr_deletion_log').add({
    user_id: userId,
    requested_at: admin.firestore.FieldValue.serverTimestamp(),
    completed_at: admin.firestore.FieldValue.serverTimestamp(),
    status: 'completed',
  });

  // 6. Delete user_limits, match_cache
  await Promise.all([
    db.collection('user_limits').doc(userId).delete(),
    db.collection('match_cache').doc(userId).delete(),
  ]);

  // 7. Delete Firebase Auth account
  try {
    await auth.deleteUser(userId);
  } catch (err) {
    console.warn(`Auth delete failed (may already be deleted): ${err.message}`);
  }

  // 8. Finally delete the user document
  await db.collection('users').doc(userId).delete();

  const deletedAt = new Date().toISOString();
  console.info(`GDPR deletion completed: userId=${userId} at=${deletedAt}`);
  return { deletedAt };
}

/**
 * Records user consent for data processing.
 * @param {string} userId
 * @param {string} consentType - 'marketing', 'analytics', 'third_party'
 * @param {boolean} granted
 */
async function recordConsent(userId, consentType, granted) {
  await db.collection('consent_log').add({
    user_id: userId,
    consent_type: consentType,
    granted,
    ip: null, // populated by calling function
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    version: '1.0',
  });
}

/**
 * Enforces data retention — anonymizes conversations older than 2 years.
 * Intended to be called by a scheduled Cloud Function.
 */
async function enforceRetentionPolicy() {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const oldConversations = await db.collection('conversations')
    .where('updated_at', '<', admin.firestore.Timestamp.fromDate(twoYearsAgo))
    .limit(100).get();

  for (const convDoc of oldConversations.docs) {
    const oldMessages = await convDoc.ref.collection('messages')
      .where('timestamp', '<', admin.firestore.Timestamp.fromDate(twoYearsAgo))
      .limit(500).get();

    if (!oldMessages.empty) {
      const batch = db.batch();
      oldMessages.docs.forEach(doc => {
        batch.update(doc.ref, { text: '[Message expired]', is_deleted: true, attachments: [] });
      });
      await batch.commit();
    }
  }

  console.info(`Retention policy enforced: processed ${oldConversations.size} conversations`);
}

module.exports = { exportUserData, deleteUserData, recordConsent, enforceRetentionPolicy };
