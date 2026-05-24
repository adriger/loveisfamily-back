'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');
const { validateText } = require('../shared/validators');
const { ERROR_CODES, TEAM_ROLES, SUBSCRIPTION_TIERS } = require('../shared/constants');
const { checkSubscriptionLimits, incrementFeatureUsage } = require('../shared/freemium');

const db = admin.firestore();

/**
 * Creates a team with the creator as owner.
 */
async function createTeam(userId, name, description, privacyType = 'public') {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID required' };

  const nameResult = validateText(name, 100);
  if (!nameResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: nameResult.error };

  const limitCheck = await checkSubscriptionLimits(userId, 'teams');
  if (!limitCheck.allowed) {
    throw { code: ERROR_CODES.SUBSCRIPTION_REQUIRED, message: limitCheck.error || 'Team creation limit reached' };
  }

  const teamRef = db.collection('teams').doc();
  const now = FieldValue.serverTimestamp();
  await teamRef.set({
    id: teamRef.id,
    name: name.trim(),
    owner_id: userId,
    description: description?.trim() || '',
    members: { [userId]: { role: TEAM_ROLES.OWNER, joined_at: new Date().toISOString() } },
    activity_ids: [],
    created_at: now,
    updated_at: now,
    privacy_type: privacyType,
    member_count: 1,
  });

  await incrementFeatureUsage(userId, 'teams');
  return { teamId: teamRef.id };
}

/**
 * Invites a user to join a team (owner/admin only).
 */
async function inviteToTeam(teamId, inviterUserId, invitedUserId) {
  const teamRef = db.collection('teams').doc(teamId);
  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Team not found' };

  const team = teamDoc.data();
  const inviterMember = team.members[inviterUserId];
  if (!inviterMember || ![TEAM_ROLES.OWNER, TEAM_ROLES.ADMIN].includes(inviterMember.role)) {
    throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Only owner or admin can invite members' };
  }

  if (invitedUserId in team.members) {
    throw { code: ERROR_CODES.ALREADY_EXISTS, message: 'User is already a member' };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const inviteRef = teamRef.collection('invitations').doc();
  await inviteRef.set({
    id: inviteRef.id,
    team_id: teamId,
    invited_user_id: invitedUserId,
    inviter_user_id: inviterUserId,
    status: 'pending',
    created_at: FieldValue.serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
  });

  return { inviteId: inviteRef.id };
}

/**
 * Accepts a team invitation.
 */
async function acceptTeamInvite(teamId, inviteId, userId) {
  const teamRef = db.collection('teams').doc(teamId);
  const inviteRef = teamRef.collection('invitations').doc(inviteId);

  await db.runTransaction(async (t) => {
    const inviteDoc = await t.get(inviteRef);
    if (!inviteDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Invitation not found' };

    const invite = inviteDoc.data();
    if (invite.invited_user_id !== userId) {
      throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Invitation is not for this user' };
    }
    if (invite.status !== 'pending') {
      throw { code: ERROR_CODES.INVALID_INPUT, message: 'Invitation is no longer valid' };
    }
    if (invite.expires_at.toMillis() < Date.now()) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: 'Invitation has expired' };
    }

    t.update(teamRef, {
      [`members.${userId}`]: { role: TEAM_ROLES.MEMBER, joined_at: new Date().toISOString() },
      member_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });
    t.update(inviteRef, { status: 'accepted' });
  });
}

/**
 * Links activity IDs to a team.
 */
async function addActivityToTeam(teamId, userId, activityIds) {
  const teamRef = db.collection('teams').doc(teamId);
  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Team not found' };

  const team = teamDoc.data();
  if (!(userId in team.members)) throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Not a team member' };

  await teamRef.update({
    activity_ids: FieldValue.arrayUnion(...activityIds),
    updated_at: FieldValue.serverTimestamp(),
  });
}

/**
 * Returns team details including full member list.
 */
async function getTeamDetails(teamId, userId) {
  const teamDoc = await db.collection('teams').doc(teamId).get();
  if (!teamDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Team not found' };

  const team = teamDoc.data();
  if (team.privacy_type === 'private' && !(userId in team.members)) {
    throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'This team is private' };
  }

  return team;
}

module.exports = { createTeam, inviteToTeam, acceptTeamInvite, addActivityToTeam, getTeamDetails };
