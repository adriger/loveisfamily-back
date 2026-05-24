'use strict';

/**
 * Main entry point for all Cloud Functions.
 * Exports are organized by module: auth, matching, messaging, community, teams, freemium.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const authFns = require('./src/auth/functions');
const authConfig = require('./src/auth/auth-config');
const matchingFns = require('./src/matching/functions');
const messagingFns = require('./src/messaging/functions');
const communityFns = require('./src/community/functions');
const teamsFns = require('./src/teams/functions');
const freemiumFns = require('./src/shared/freemium');

const { ERROR_CODES, FUNCTION_CONFIG } = require('./src/shared/constants');

const runtimeOpts = {
  timeoutSeconds: FUNCTION_CONFIG.TIMEOUT_SECONDS,
  memory: FUNCTION_CONFIG.MEMORY,
};

function handleError(err) {
  if (err.code && err.message) {
    throw new functions.https.HttpsError('failed-precondition', err.message, { code: err.code });
  }
  console.error('Unhandled error:', err);
  throw new functions.https.HttpsError('internal', 'Internal server error');
}

function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  return context.auth.uid;
}

// ── AUTH ─────────────────────────────────────────────────────────────────────

/** @type {functions.HttpsFunction} */
exports.createUser = functions.runWith(runtimeOpts).https.onCall(async (data) => {
  try {
    return await authFns.createUser(data.email, data.password, data.username);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.updateUserProfile = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await authFns.updateUserProfile(uid, data);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.deleteUserAccount = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await authFns.deleteUserAccount(uid);
  } catch (err) { handleError(err); }
});

// ── MATCHING ──────────────────────────────────────────────────────────────────

/** @type {functions.HttpsFunction} */
exports.getMatchingSuggestions = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.getMatchingSuggestions(uid, data.limit || 10);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.createMatch = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.createMatch(uid, data.targetUserId, data.matchType);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.respondToMatch = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.respondToMatch(data.matchId, uid, data.response);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.getMatchHistory = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.getMatchHistory(uid, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

// ── MESSAGING ─────────────────────────────────────────────────────────────────

exports.sendMessage = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.sendMessage(data.conversationId, uid, data.text, data.attachments);
  } catch (err) { handleError(err); }
});

exports.getConversations = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.getConversations(uid);
  } catch (err) { handleError(err); }
});

exports.getMessages = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.getMessages(data.conversationId, uid, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

exports.markAsRead = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.markAsRead(data.conversationId, uid);
  } catch (err) { handleError(err); }
});

exports.deleteMessage = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.deleteMessage(data.messageId, data.conversationId, uid);
  } catch (err) { handleError(err); }
});

// ── COMMUNITY ─────────────────────────────────────────────────────────────────

exports.createPost = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.createPost(uid, data.title, data.description, data.images, data.activityType, data.tags, data.location, data.visibility);
  } catch (err) { handleError(err); }
});

exports.likePost = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.likePost(data.postId, uid);
  } catch (err) { handleError(err); }
});

exports.commentOnPost = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.commentOnPost(data.postId, uid, data.text);
  } catch (err) { handleError(err); }
});

exports.getPostFeed = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.getPostFeed(uid, data.filters, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

exports.deletePost = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.deletePost(data.postId, uid);
  } catch (err) { handleError(err); }
});

// ── TEAMS ─────────────────────────────────────────────────────────────────────

exports.createTeam = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.createTeam(uid, data.name, data.description, data.privacyType);
  } catch (err) { handleError(err); }
});

exports.inviteToTeam = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.inviteToTeam(data.teamId, uid, data.invitedUserId);
  } catch (err) { handleError(err); }
});

exports.acceptTeamInvite = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.acceptTeamInvite(data.teamId, data.inviteId, uid);
  } catch (err) { handleError(err); }
});

exports.addActivityToTeam = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.addActivityToTeam(data.teamId, uid, data.activityIds);
  } catch (err) { handleError(err); }
});

exports.getTeamDetails = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.getTeamDetails(data.teamId, uid);
  } catch (err) { handleError(err); }
});

// ── FREEMIUM ──────────────────────────────────────────────────────────────────

exports.checkSubscriptionLimits = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await freemiumFns.checkSubscriptionLimits(uid, data.feature);
  } catch (err) { handleError(err); }
});

exports.upgradeSubscription = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await freemiumFns.upgradeSubscription(uid, data.tier, data.paymentId);
  } catch (err) { handleError(err); }
});

// ── AUTH TRIGGERS ─────────────────────────────────────────────────────────────

// Sets default custom claims on every new Firebase Auth user
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    await authConfig.setCustomClaims(user.uid, { subscription_type: 'free' });
  } catch (err) {
    console.error(`onUserCreated: failed to set claims for ${user.uid}`, err);
  }
});

// Cleans up all user data when a Firebase Auth account is deleted
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    await authFns.deleteUserAccount(user.uid);
  } catch (err) {
    console.error(`onUserDeleted: cleanup failed for ${user.uid}`, err);
  }
});
