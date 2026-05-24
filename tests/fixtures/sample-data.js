'use strict';

const NOW = Date.now();

const users = {
  activeUser: {
    id: 'user_active_001',
    email: 'active@example.com',
    username: 'activeuser',
    displayName: 'Active User',
    interests: ['sports', 'cooking', 'travel'],
    location: { latitude: 40.7128, longitude: -74.006 },
    age: 28,
    subscription_type: 'free',
    last_login_at: new Date(NOW - 3600000), // 1 hour ago
    created_at: new Date(NOW - 90 * 86400000),
    logins_30d: 25,
  },
  premiumUser: {
    id: 'user_premium_002',
    email: 'premium@example.com',
    username: 'premiumuser',
    displayName: 'Premium User',
    interests: ['sports', 'travel', 'music'],
    location: { latitude: 40.758, longitude: -73.9855 },
    age: 26,
    subscription_type: 'premium',
    subscription_end_date: new Date(NOW + 30 * 86400000),
    last_login_at: new Date(NOW - 7200000),
    created_at: new Date(NOW - 180 * 86400000),
    logins_30d: 20,
  },
  vipUser: {
    id: 'user_vip_003',
    email: 'vip@example.com',
    username: 'vipuser',
    displayName: 'VIP User',
    interests: ['art', 'wine', 'travel', 'yoga'],
    location: { latitude: 40.7306, longitude: -73.9352 },
    age: 32,
    subscription_type: 'vip',
    subscription_end_date: new Date(NOW + 30 * 86400000),
    last_login_at: new Date(NOW - 1800000),
    created_at: new Date(NOW - 365 * 86400000),
    logins_30d: 30,
  },
  newUser: {
    id: 'user_new_004',
    email: 'new@example.com',
    username: 'newuser',
    displayName: 'New User',
    interests: [],
    location: null,
    age: null,
    subscription_type: 'free',
    last_login_at: new Date(NOW - 3600000),
    created_at: new Date(NOW - 3600000),
    logins_30d: 1,
  },
  inactiveUser: {
    id: 'user_inactive_005',
    email: 'inactive@example.com',
    username: 'inactiveuser',
    displayName: 'Inactive User',
    interests: ['sports'],
    location: { latitude: 40.7128, longitude: -74.006 },
    age: 35,
    subscription_type: 'free',
    last_login_at: new Date(NOW - 31 * 86400000), // 31 days ago
    created_at: new Date(NOW - 180 * 86400000),
    logins_30d: 0,
  },
};

const matches = {
  pendingMatch: {
    id: 'match_pending_001',
    user1_id: users.activeUser.id,
    user2_id: users.premiumUser.id,
    compatibility_score: 0.75,
    match_type: 'algorithm',
    status: 'pending',
    created_at: new Date(NOW - 3600000),
    expires_at: new Date(NOW + 29 * 86400000),
    updated_at: new Date(NOW - 3600000),
  },
  acceptedMatch: {
    id: 'match_accepted_002',
    user1_id: users.activeUser.id,
    user2_id: users.vipUser.id,
    compatibility_score: 0.85,
    match_type: 'instant',
    status: 'accepted',
    created_at: new Date(NOW - 7200000),
    expires_at: new Date(NOW + 28 * 86400000),
    updated_at: new Date(NOW - 3600000),
  },
  mutualMatch: {
    id: 'match_mutual_003',
    user1_id: users.premiumUser.id,
    user2_id: users.vipUser.id,
    compatibility_score: 0.90,
    match_type: 'algorithm',
    status: 'mutual_match',
    conversation_id: 'conv_001',
    created_at: new Date(NOW - 86400000),
    expires_at: new Date(NOW + 25 * 86400000),
    updated_at: new Date(NOW - 43200000),
  },
  expiredMatch: {
    id: 'match_expired_004',
    user1_id: users.activeUser.id,
    user2_id: users.inactiveUser.id,
    compatibility_score: 0.30,
    match_type: 'algorithm',
    status: 'expired',
    created_at: new Date(NOW - 31 * 86400000),
    expires_at: new Date(NOW - 1 * 86400000),
    updated_at: new Date(NOW - 1 * 86400000),
  },
};

const conversations = {
  activeConversation: {
    id: 'conv_001',
    participant1_id: users.premiumUser.id,
    participant2_id: users.vipUser.id,
    last_message_text: 'Hey, how are you?',
    last_message_timestamp: new Date(NOW - 1800000),
    unread_count_p1: 0,
    unread_count_p2: 2,
    created_at: new Date(NOW - 86400000),
    updated_at: new Date(NOW - 1800000),
    is_archived: false,
  },
};

const messages = {
  hello: {
    id: 'msg_001',
    sender_id: users.premiumUser.id,
    text: 'Hey, how are you?',
    timestamp: new Date(NOW - 1800000),
    is_read: false,
    attachments: [],
    is_edited: false,
    edited_at: null,
    is_deleted: false,
    reactions: {},
  },
};

/**
 * Generates N random test users with varied attributes.
 * @param {number} count
 * @returns {Array}
 */
function generateTestUsers(count) {
  const interests = ['sports', 'cooking', 'travel', 'music', 'art', 'gaming', 'reading', 'yoga'];
  return Array.from({ length: count }, (_, i) => ({
    id: `gen_user_${i}`,
    email: `gen${i}@example.com`,
    username: `genuser${i}`,
    displayName: `Generated User ${i}`,
    interests: interests.slice(0, (i % 5) + 1),
    location: {
      latitude: 40.7128 + (Math.random() - 0.5) * 0.5,
      longitude: -74.006 + (Math.random() - 0.5) * 0.5,
    },
    age: 20 + Math.floor(Math.random() * 30),
    subscription_type: ['free', 'premium', 'vip'][Math.floor(Math.random() * 3)],
    last_login_at: new Date(NOW - Math.random() * 7 * 86400000),
    created_at: new Date(NOW - 180 * 86400000),
    logins_30d: Math.floor(Math.random() * 30),
  }));
}

module.exports = { users, matches, conversations, messages, generateTestUsers };
