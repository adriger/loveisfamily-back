'use strict';

const admin = require('firebase-admin');
const { FieldValue } = require('@google-cloud/firestore');
const { ERROR_CODES } = require('../shared/constants');

const db = admin.firestore();

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * Submits a profile verification request with an identity document photo URL.
 */
async function submitProfileVerification(userId, documentPhotoURL) {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID required' };
  if (!documentPhotoURL) throw { code: ERROR_CODES.INVALID_INPUT, message: 'Document photo URL required' };

  const verificationRef = db.collection('verifications').doc(userId);
  const existing = await verificationRef.get();

  if (existing.exists && existing.data().status === VERIFICATION_STATUS.PENDING) {
    throw { code: ERROR_CODES.ALREADY_EXISTS, message: 'A verification request is already pending' };
  }

  await verificationRef.set({
    user_id: userId,
    document_photo_url: documentPhotoURL,
    status: VERIFICATION_STATUS.PENDING,
    submitted_at: FieldValue.serverTimestamp(),
    reviewed_at: null,
    rejection_reason: null,
  });

  await db.collection('users').doc(userId).update({
    verification_status: VERIFICATION_STATUS.PENDING,
    updated_at: FieldValue.serverTimestamp(),
  });

  return { status: VERIFICATION_STATUS.PENDING };
}

/**
 * Returns the current verification status for a user.
 */
async function getVerificationStatus(userId) {
  const verificationDoc = await db.collection('verifications').doc(userId).get();

  if (!verificationDoc.exists) {
    return { status: 'not_submitted' };
  }

  const data = verificationDoc.data();
  return {
    status: data.status,
    submittedAt: data.submitted_at,
    rejectionReason: data.rejection_reason || null,
  };
}

module.exports = { submitProfileVerification, getVerificationStatus, VERIFICATION_STATUS };
