'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');
const { validateEmail, validatePassword, validateUsername, validateAge } = require('../shared/validators');
const { ERROR_CODES, SUBSCRIPTION_TIERS } = require('../shared/constants');
const { setCustomClaims } = require('./auth-config');

const db = admin.firestore();
const auth = admin.auth();

/**
 * Registers a new user in Firebase Auth and creates Firestore documents.
 * @param {string} email
 * @param {string} password
 * @param {string} username
 * @returns {Promise<{ uid: string, email: string, username: string }>}
 */
async function createUser(email, password, username) {
  const emailResult = validateEmail(email);
  if (!emailResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: emailResult.error };

  const passwordResult = validatePassword(password);
  if (!passwordResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: passwordResult.error };

  const usernameResult = validateUsername(username);
  if (!usernameResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: usernameResult.error };

  // Check username uniqueness
  const usernameQuery = await db.collection('users').where('username', '==', username).limit(1).get();
  if (!usernameQuery.empty) {
    throw { code: ERROR_CODES.ALREADY_EXISTS, message: 'Username already taken' };
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: username,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw { code: ERROR_CODES.ALREADY_EXISTS, message: 'Email already registered' };
    }
    throw { code: ERROR_CODES.INTERNAL_ERROR, message: err.message };
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  const userRef = db.collection('users').doc(userRecord.uid);
  batch.set(userRef, {
    id: userRecord.uid,
    email: email.toLowerCase().trim(),
    username,
    displayName: username,
    photoURL: null,
    bio: '',
    interests: [],
    subscription_type: SUBSCRIPTION_TIERS.FREE,
    subscription_end_date: null,
    location: null,
    age: null,
    gender: null,
    created_at: now,
    updated_at: now,
  });

  const profileRef = userRef.collection('profiles').doc('main');
  batch.set(profileRef, {
    premium_features: [],
    badges: [],
    followers_count: 0,
    following_count: 0,
    created_at: now,
  });

  const limitsRef = db.collection('user_limits').doc(userRecord.uid);
  batch.set(limitsRef, {
    matches_today: 0,
    teams_created_month: 0,
    posts_today: 0,
    last_match_reset_date: now,
    last_team_reset_date: now,
    last_post_reset_date: now,
    subscription_tier: SUBSCRIPTION_TIERS.FREE,
  });

  await batch.commit();

  // Set initial custom claims so the JWT reflects subscription_type immediately
  await setCustomClaims(userRecord.uid, { subscription_type: SUBSCRIPTION_TIERS.FREE });

  console.info(`User created: uid=${userRecord.uid} email=${email} username=${username}`);
  return { uid: userRecord.uid, email: email.toLowerCase().trim(), username };
}

/**
 * Updates a user's profile fields with validation.
 * @param {string} userId
 * @param {object} data - Fields to update
 * @returns {Promise<void>}
 */
async function updateUserProfile(userId, data) {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID is required' };

  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'User not found' };

  const allowedFields = ['displayName', 'bio', 'interests', 'location', 'age', 'gender', 'photoURL'];
  const updates = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (updates.age !== undefined) {
    const ageResult = validateAge(updates.age);
    if (!ageResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: ageResult.error };
  }

  if (updates.interests !== undefined) {
    if (!Array.isArray(updates.interests) || updates.interests.length > 20) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: 'Interests must be an array of max 20 items' };
    }
  }

  if (Object.keys(updates).length === 0) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'No valid fields to update' };
  }

  updates.updated_at = FieldValue.serverTimestamp();
  await userRef.update(updates);

  console.info(`Profile updated: userId=${userId} fields=${Object.keys(updates).join(',')}`);
}

/**
 * GDPR-compliant account deletion — removes all user data from Firestore and Auth.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteUserAccount(userId) {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID is required' };

  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'User not found' };

  // Anonymize messages sent by user
  const messagesQuery = await db.collectionGroup('messages')
    .where('sender_id', '==', userId).get();
  const msgBatch = db.batch();
  messagesQuery.docs.forEach(doc => {
    msgBatch.update(doc.ref, { sender_id: 'deleted_user', text: '[Message deleted]', is_deleted: true });
  });
  await msgBatch.commit();

  // Remove from matches
  const matchesQuery1 = await db.collection('matches').where('user1_id', '==', userId).get();
  const matchesQuery2 = await db.collection('matches').where('user2_id', '==', userId).get();
  const matchBatch = db.batch();
  [...matchesQuery1.docs, ...matchesQuery2.docs].forEach(doc => matchBatch.delete(doc.ref));
  await matchBatch.commit();

  // Archive posts (not delete) — mark as archived
  const postsQuery = await db.collection('posts').where('author_id', '==', userId).get();
  const postBatch = db.batch();
  postsQuery.docs.forEach(doc => {
    postBatch.update(doc.ref, { author_id: 'deleted_user', is_archived: true });
  });
  await postBatch.commit();

  // Remove from teams (leave all teams, delete if owner)
  const teamsOwnerQuery = await db.collection('teams').where('owner_id', '==', userId).get();
  const teamBatch = db.batch();
  teamsOwnerQuery.docs.forEach(doc => teamBatch.delete(doc.ref));
  await teamBatch.commit();

  // Delete subcollections and main user document
  await db.collection('user_limits').doc(userId).delete();
  await userRef.delete();

  // Delete Firebase Auth account
  try {
    await auth.deleteUser(userId);
  } catch (err) {
    console.warn(`Auth delete failed for user ${userId}: ${err.message}`);
  }

  console.info(`Account deleted (GDPR): userId=${userId}`);
}

module.exports = { createUser, updateUserProfile, deleteUserAccount };
