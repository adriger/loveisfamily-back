'use strict';
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const admin = require('firebase-admin');
const { validateText, validateUrl } = require('../shared/validators');
const { ERROR_CODES, POST_VISIBILITY, ACTIVITY_TYPES } = require('../shared/constants');
const { checkSubscriptionLimits, incrementFeatureUsage } = require('../shared/freemium');

const db = admin.firestore();

/**
 * Creates a community post.
 */
async function createPost(userId, title, description, images = [], activityType, tags = [], location = null, visibility = POST_VISIBILITY.PUBLIC) {
  if (!userId) throw { code: ERROR_CODES.INVALID_INPUT, message: 'User ID required' };

  const titleResult = validateText(title, 200);
  if (!titleResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: titleResult.error };

  const descResult = validateText(description, 5000);
  if (!descResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: descResult.error };

  if (!Object.values(ACTIVITY_TYPES).includes(activityType)) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Invalid activity type' };
  }

  const limitCheck = await checkSubscriptionLimits(userId, 'posts');
  if (!limitCheck.allowed) {
    throw { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: 'Daily post limit reached' };
  }

  const postRef = db.collection('posts').doc();
  await postRef.set({
    id: postRef.id,
    author_id: userId,
    title: title.trim(),
    description: description.trim(),
    images: images.slice(0, 10),
    activity_type: activityType,
    tags: tags.slice(0, 20),
    likes_count: 0,
    comments_count: 0,
    location,
    visibility,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    is_archived: false,
  });

  await incrementFeatureUsage(userId, 'posts');
  return { postId: postRef.id };
}

/**
 * Toggles a like on a post (add or remove).
 */
async function likePost(postId, userId) {
  const postRef = db.collection('posts').doc(postId);
  const likeRef = postRef.collection('likes').doc(userId);

  await db.runTransaction(async (t) => {
    const likeDoc = await t.get(likeRef);
    const postDoc = await t.get(postRef);
    if (!postDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Post not found' };

    if (likeDoc.exists) {
      t.delete(likeRef);
      t.update(postRef, { likes_count: FieldValue.increment(-1) });
    } else {
      t.set(likeRef, { user_id: userId, created_at: FieldValue.serverTimestamp() });
      t.update(postRef, { likes_count: FieldValue.increment(1) });
    }
  });
}

/**
 * Adds a comment to a post.
 */
async function commentOnPost(postId, userId, text) {
  const textResult = validateText(text, 1000);
  if (!textResult.valid) throw { code: ERROR_CODES.INVALID_INPUT, message: textResult.error };

  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Post not found' };

  const commentRef = postRef.collection('comments').doc();
  await db.runTransaction(async (t) => {
    t.set(commentRef, {
      id: commentRef.id,
      author_id: userId,
      text: text.trim(),
      timestamp: FieldValue.serverTimestamp(),
      likes_count: 0,
    });
    t.update(postRef, { comments_count: FieldValue.increment(1) });
  });

  return { commentId: commentRef.id };
}

/**
 * Returns a ranked post feed based on user interests.
 */
async function getPostFeed(userId, filters = {}, limit = 20, startAfter = null) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userInterests = userDoc.exists ? (userDoc.data().interests || []) : [];

  let query = db.collection('posts')
    .where('visibility', '==', POST_VISIBILITY.PUBLIC)
    .where('is_archived', '==', false)
    .orderBy('created_at', 'desc')
    .limit(limit + 1);

  if (filters.activityType) {
    query = db.collection('posts')
      .where('visibility', '==', POST_VISIBILITY.PUBLIC)
      .where('activity_type', '==', filters.activityType)
      .where('is_archived', '==', false)
      .orderBy('created_at', 'desc')
      .limit(limit + 1);
  }

  if (startAfter) {
    const cursorDoc = await db.collection('posts').doc(startAfter).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  let posts = snap.docs.slice(0, limit).map(d => d.data());

  // Simple interest-based ranking boost
  if (userInterests.length > 0) {
    posts = posts.map(p => ({
      ...p,
      _relevance: p.tags?.filter(t => userInterests.includes(t)).length || 0,
    })).sort((a, b) => b._relevance - a._relevance || b.created_at?.toMillis() - a.created_at?.toMillis());
  }

  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { posts: posts.map(({ _relevance, ...p }) => p), nextCursor };
}

/**
 * Deletes a post (only owner can delete).
 */
async function deletePost(postId, userId) {
  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Post not found' };
  if (postDoc.data().author_id !== userId) {
    throw { code: ERROR_CODES.PERMISSION_DENIED, message: 'Can only delete your own posts' };
  }
  await postRef.delete();
}

/**
 * Returns comments for a post ordered by timestamp descending.
 */
async function getPostComments(postId, limit = 50, startAfter = null) {
  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Post not found' };

  let query = postRef.collection('comments')
    .orderBy('timestamp', 'desc')
    .limit(limit + 1);

  if (startAfter) {
    const cursorDoc = await postRef.collection('comments').doc(startAfter).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  const comments = snap.docs.slice(0, limit).map(d => d.data());
  const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;
  return { comments, nextCursor };
}

module.exports = { createPost, likePost, commentOnPost, getPostFeed, deletePost, getPostComments };
