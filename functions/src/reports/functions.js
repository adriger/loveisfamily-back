'use strict';
const { FieldValue } = require('@google-cloud/firestore');
const admin = require('firebase-admin');
const { ERROR_CODES } = require('../shared/constants');

const db = admin.firestore();

const VALID_REASONS = [
  'contenido_inapropiado',
  'spam',
  'acoso',
  'informacion_falsa',
  'otro',
];

async function reportContent(userId, { contentType, contentId, reason, description }) {
  if (!userId) throw { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' };
  if (!['post', 'comment', 'user'].includes(contentType)) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Tipo de contenido inválido' };
  }
  if (!VALID_REASONS.includes(reason)) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Motivo inválido' };
  }

  // Avoid duplicate reports from same user
  const existing = await db.collection('reports')
    .where('reporter_id', '==', userId)
    .where('content_id', '==', contentId)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { alreadyReported: true };
  }

  const ref = db.collection('reports').doc();
  await ref.set({
    id: ref.id,
    content_type: contentType,
    content_id: contentId,
    reporter_id: userId,
    reason,
    description: description || '',
    status: 'pending',
    resolved_by: null,
    resolution_action: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  // Increment report count on the content document
  const collectionMap = { post: 'community_posts', comment: null, user: 'users' };
  const col = collectionMap[contentType];
  if (col) {
    await db.collection(col).doc(contentId).update({
      report_count: FieldValue.increment(1),
    }).catch(() => {}); // ignore if field doesn't exist yet
  }

  return { reportId: ref.id };
}

module.exports = { reportContent };
