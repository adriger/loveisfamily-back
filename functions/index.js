'use strict';

/**
 * Main entry point for all Cloud Functions.
 * Exports are organized by module: auth, matching, messaging, community, teams, freemium.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const authFns = require('./src/auth/functions');
const authConfig = require('./src/auth/auth-config');
const verificationFns = require('./src/auth/verification');
const matchingFns = require('./src/matching/functions');
const messagingFns = require('./src/messaging/functions');
const communityFns = require('./src/community/functions');
const teamsFns = require('./src/teams/functions');
const freemiumFns = require('./src/shared/freemium');
const servicesFns = require('./src/services/functions');
const reportsFns = require('./src/reports/functions');

const { ERROR_CODES, FUNCTION_CONFIG } = require('./src/shared/constants');

const runtimeOpts = {
  timeoutSeconds: FUNCTION_CONFIG.TIMEOUT_SECONDS,
  memory: FUNCTION_CONFIG.MEMORY,
};

// Helper para crear funciones en europe-west1 con las opciones estándar
const fn = () => functions.region('europe-west1').runWith(runtimeOpts);

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
exports.createUser = fn().https.onCall(async (data) => {
  try {
    return await authFns.createUser(data.email, data.password, data.username);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.updateUserProfile = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await authFns.updateUserProfile(uid, data);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.deleteUserAccount = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await authFns.deleteUserAccount(uid);
  } catch (err) { handleError(err); }
});

exports.sendVerificationCode = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await authFns.sendVerificationCode(uid);
  } catch (err) { handleError(err); }
});

exports.verifyEmailCode = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { code } = data;
  if (!code) throw new functions.https.HttpsError('invalid-argument', 'Code required');
  try {
    return await authFns.verifyEmailCode(uid, code);
  } catch (err) { handleError(err); }
});

exports.initSocialProfile = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await authFns.initSocialProfile(uid, data);
  } catch (err) { handleError(err); }
});

// ── MATCHING ──────────────────────────────────────────────────────────────────

/** @type {functions.HttpsFunction} */
exports.getMatchingSuggestions = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.getMatchingSuggestions(uid, data.limit || 10);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.createMatch = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.createMatch(uid, data.targetUserId, data.matchType);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.respondToMatch = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.respondToMatch(data.matchId, uid, data.response);
  } catch (err) { handleError(err); }
});

/** @type {functions.HttpsFunction} */
exports.getMatchHistory = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await matchingFns.getMatchHistory(uid, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

// ── MESSAGING ─────────────────────────────────────────────────────────────────

exports.sendMessage = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.sendMessage(data.conversationId, uid, data.text, data.attachments);
  } catch (err) { handleError(err); }
});

exports.getConversations = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.getConversations(uid);
  } catch (err) { handleError(err); }
});

exports.getMessages = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.getMessages(data.conversationId, uid, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

exports.markAsRead = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.markAsRead(data.conversationId, uid);
  } catch (err) { handleError(err); }
});

exports.deleteMessage = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await messagingFns.deleteMessage(data.messageId, data.conversationId, uid);
  } catch (err) { handleError(err); }
});

exports.registerPushToken = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { token, platform } = data;
  try {
    return await messagingFns.registerPushToken(uid, token, platform || 'ios');
  } catch (err) { handleError(err); }
});

// ── COMMUNITY ─────────────────────────────────────────────────────────────────

exports.createPost = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.createPost(uid, data.title, data.description, data.images, data.activityType, data.tags, data.location, data.visibility);
  } catch (err) { handleError(err); }
});

exports.likePost = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.likePost(data.postId, uid);
  } catch (err) { handleError(err); }
});

exports.commentOnPost = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.commentOnPost(data.postId, uid, data.text);
  } catch (err) { handleError(err); }
});

exports.getPostFeed = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.getPostFeed(uid, data.filters, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

exports.deletePost = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await communityFns.deletePost(data.postId, uid);
  } catch (err) { handleError(err); }
});

exports.getPostComments = fn().https.onCall(async (data, context) => {
  requireAuth(context);
  try {
    return await communityFns.getPostComments(data.postId, data.limit, data.startAfter);
  } catch (err) { handleError(err); }
});

// ── TEAMS ─────────────────────────────────────────────────────────────────────

exports.createTeam = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.createTeam(uid, data.name, data.description, data.privacyType);
  } catch (err) { handleError(err); }
});

exports.inviteToTeam = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.inviteToTeam(data.teamId, uid, data.invitedUserId);
  } catch (err) { handleError(err); }
});

exports.acceptTeamInvite = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.acceptTeamInvite(data.teamId, data.inviteId, uid);
  } catch (err) { handleError(err); }
});

exports.addActivityToTeam = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.addActivityToTeam(data.teamId, uid, data.activityIds);
  } catch (err) { handleError(err); }
});

exports.getTeamDetails = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.getTeamDetails(data.teamId, uid);
  } catch (err) { handleError(err); }
});

exports.listTeams = fn().https.onCall(async (data, context) => {
  requireAuth(context);
  try {
    return await teamsFns.listTeams(data.limit, data.startAfter, data.search);
  } catch (err) { handleError(err); }
});

exports.joinTeam = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await teamsFns.joinTeam(data.teamId, uid);
  } catch (err) { handleError(err); }
});

// ── VERIFICATION ─────────────────────────────────────────────────────────────

exports.submitProfileVerification = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await verificationFns.submitProfileVerification(uid, data.documentPhotoURL);
  } catch (err) { handleError(err); }
});

exports.getVerificationStatus = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await verificationFns.getVerificationStatus(uid);
  } catch (err) { handleError(err); }
});

// ── FREEMIUM ──────────────────────────────────────────────────────────────────

exports.checkSubscriptionLimits = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await freemiumFns.checkSubscriptionLimits(uid, data.feature);
  } catch (err) { handleError(err); }
});

exports.upgradeSubscription = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await freemiumFns.upgradeSubscription(uid, data.tier, data.paymentId);
  } catch (err) { handleError(err); }
});

// ── SERVICES & RESERVATIONS ───────────────────────────────────────────────────

exports.getServices = fn().https.onCall(async (data) => {
  try {
    return await servicesFns.getServices(data);
  } catch (err) { handleError(err); }
});

exports.createReservation = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await servicesFns.createReservation(uid, data);
  } catch (err) { handleError(err); }
});

exports.getUserReservations = fn().https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  try {
    return await servicesFns.getUserReservations(uid);
  } catch (err) { handleError(err); }
});

// ── REPORTS ───────────────────────────────────────────────────────────────────

exports.reportContent = fn().https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  try {
    return await reportsFns.reportContent(uid, data);
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
