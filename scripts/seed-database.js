'use strict';

/**
 * Seeds the Firestore emulator with realistic test data.
 * Run against emulators only: FIRESTORE_EMULATOR_HOST must be set.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node scripts/seed-database.js
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'loveisfamily-dev' });
}

const db = admin.firestore();
const auth = admin.auth();

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(arr, min = 1, max = 4) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const count = min + Math.floor(Math.random() * (max - min + 1));
  return shuffled.slice(0, count);
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return admin.firestore.Timestamp.fromDate(d);
}

// ── Static test data ──────────────────────────────────────────────────────────

const INTERESTS = ['hiking', 'cycling', 'yoga', 'cooking', 'photography', 'gaming', 'reading', 'travel', 'music', 'fitness', 'art', 'swimming'];
const CITIES = [
  { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { name: 'Barcelona', lat: 41.3851, lng: 2.1734 },
  { name: 'Valencia', lat: 39.4699, lng: -0.3763 },
  { name: 'Seville', lat: 37.3891, lng: -5.9845 },
];
const TIERS = ['free', 'premium', 'vip'];
const ACTIVITY_TYPES = ['sports', 'social', 'hobby'];

const USERS_SEED = [
  { username: 'alice_madrid',    email: 'alice@test.com',   displayName: 'Alice García',    age: 28, city: 0, tier: 'premium' },
  { username: 'bob_bcn',         email: 'bob@test.com',     displayName: 'Bob Martínez',    age: 32, city: 1, tier: 'free' },
  { username: 'carla_valencia',  email: 'carla@test.com',   displayName: 'Carla López',     age: 25, city: 2, tier: 'vip' },
  { username: 'david_sevilla',   email: 'david@test.com',   displayName: 'David Ruiz',      age: 35, city: 3, tier: 'free' },
  { username: 'elena_madrid',    email: 'elena@test.com',   displayName: 'Elena Fernández', age: 30, city: 0, tier: 'premium' },
  { username: 'fran_bcn',        email: 'fran@test.com',    displayName: 'Fran Torres',     age: 27, city: 1, tier: 'free' },
];

const PASSWORD = 'Test1234!';

// ── Seeding functions ─────────────────────────────────────────────────────────

async function createAuthUser(seed) {
  try {
    const user = await auth.createUser({
      email: seed.email,
      password: PASSWORD,
      displayName: seed.displayName,
    });
    await auth.setCustomUserClaims(user.uid, { subscription_type: seed.tier });
    console.log(`  ✓ Auth user: ${seed.email} (uid: ${user.uid})`);
    return user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(seed.email);
      await auth.setCustomUserClaims(user.uid, { subscription_type: seed.tier });
      console.log(`  ~ Auth user exists: ${seed.email} (uid: ${user.uid})`);
      return user.uid;
    }
    throw err;
  }
}

async function seedUsers() {
  console.log('\n── Users ──');
  const uids = [];

  for (const seed of USERS_SEED) {
    const uid = await createAuthUser(seed);
    const city = CITIES[seed.city];

    await db.collection('users').doc(uid).set({
      id: uid,
      email: seed.email,
      username: seed.username,
      displayName: seed.displayName,
      photoURL: null,
      bio: '',
      age: seed.age,
      gender: null,
      interests: randomSubset(INTERESTS, 3, 6),
      location: {
        latitude: city.lat + (Math.random() - 0.5) * 0.1,
        longitude: city.lng + (Math.random() - 0.5) * 0.1,
        city: city.name,
      },
      subscription_type: seed.tier,
      subscription_end_date: seed.tier !== 'free' ? daysAgo(-30) : null,
      created_at: daysAgo(randomInt(10, 60)),
      updated_at: daysAgo(randomInt(0, 5)),
    });

    // user_limits doc (matches functions' schema)
    await db.collection('user_limits').doc(uid).set({
      matches_today: 0,
      teams_created_month: 0,
      posts_today: 0,
      last_match_reset_date: daysAgo(0),
      last_team_reset_date: daysAgo(0),
      last_post_reset_date: daysAgo(0),
      subscription_tier: seed.tier,
    });

    console.log(`  ✓ Firestore user: ${seed.username} (${seed.tier})`);
    uids.push(uid);
  }

  return uids;
}

async function seedMatches(uids) {
  console.log('\n── Matches ──');
  const pairs = [
    [0, 1, 'mutual_match'],
    [0, 2, 'pending'],
    [1, 3, 'accepted'],
    [2, 4, 'rejected'],
    [3, 5, 'mutual_match'],
  ];

  for (const [i, j, status] of pairs) {
    const ref = db.collection('matches').doc();
    await ref.set({
      id: ref.id,
      initiatorId: uids[i],
      targetId: uids[j],
      status,
      matchType: 'algorithm',
      compatibilityScore: Math.random() * 0.5 + 0.4,
      createdAt: daysAgo(randomInt(1, 14)),
      updatedAt: daysAgo(randomInt(0, 3)),
    });
    console.log(`  ✓ Match ${status}: user[${i}] ↔ user[${j}]`);
  }
}

async function seedConversations(uids) {
  console.log('\n── Conversations & Messages ──');
  // Create conversation between alice and bob (mutual match)
  const convRef = db.collection('conversations').doc();
  const convId = convRef.id;

  await convRef.set({
    id: convId,
    participants: [uids[0], uids[1]],
    participantMap: { [uids[0]]: true, [uids[1]]: true },
    lastMessage: { text: 'Hey! Want to go hiking this weekend?', senderId: uids[0] },
    lastMessageAt: daysAgo(1),
    unreadCount: { [uids[0]]: 0, [uids[1]]: 1 },
    createdAt: daysAgo(5),
  });

  const messages = [
    { senderId: uids[0], text: 'Hi! I saw we matched. Nice interests!', createdAt: daysAgo(5) },
    { senderId: uids[1], text: 'Hey! Yeah, we both love hiking and cycling.', createdAt: daysAgo(4) },
    { senderId: uids[0], text: 'Want to go hiking this weekend?', createdAt: daysAgo(1) },
  ];

  for (const msg of messages) {
    const msgRef = db.collection('conversations').doc(convId).collection('messages').doc();
    await msgRef.set({
      id: msgRef.id,
      conversationId: convId,
      ...msg,
      readBy: [msg.senderId],
      deleted: false,
    });
  }

  console.log(`  ✓ Conversation with ${messages.length} messages`);
  return convId;
}

async function seedPosts(uids) {
  console.log('\n── Community Posts ──');
  const posts = [
    {
      authorId: uids[0],
      title: 'Sunday hike in Sierra de Guadarrama',
      description: 'Looking for hiking buddies for this Sunday! Intermediate level, about 15km. Bring water and snacks.',
      activityType: 'sports',
      tags: ['hiking', 'nature', 'weekend'],
      visibility: 'public',
    },
    {
      authorId: uids[2],
      title: 'Yoga class in Parque del Retiro',
      description: 'Free outdoor yoga session every Saturday at 9am. All levels welcome!',
      activityType: 'sports',
      tags: ['yoga', 'wellness', 'free'],
      visibility: 'public',
    },
    {
      authorId: uids[4],
      title: 'Board game night - looking for players',
      description: 'We host a board game night every Friday. From Catan to Pandemic. Join us!',
      activityType: 'social',
      tags: ['boardgames', 'fun', 'friday'],
      visibility: 'public',
    },
  ];

  const postIds = [];
  for (const post of posts) {
    const ref = db.collection('posts').doc();
    await ref.set({
      id: ref.id,
      ...post,
      location: { city: 'Madrid' },
      likes: randomInt(0, 20),
      commentCount: randomInt(0, 5),
      likedBy: [],
      createdAt: daysAgo(randomInt(1, 10)),
      updatedAt: daysAgo(randomInt(0, 2)),
    });
    console.log(`  ✓ Post: "${post.title}"`);
    postIds.push(ref.id);
  }
  return postIds;
}

async function seedTeams(uids) {
  console.log('\n── Teams ──');
  const ref = db.collection('teams').doc();
  await ref.set({
    id: ref.id,
    name: 'Madrid Hikers',
    description: 'A group for hiking enthusiasts in and around Madrid.',
    ownerId: uids[2], // carla (VIP)
    privacyType: 'public',
    members: {
      [uids[2]]: { role: 'owner', joinedAt: daysAgo(20) },
      [uids[0]]: { role: 'member', joinedAt: daysAgo(10) },
      [uids[4]]: { role: 'member', joinedAt: daysAgo(5) },
    },
    memberCount: 3,
    activityIds: ['hiking', 'nature'],
    createdAt: daysAgo(20),
  });
  console.log(`  ✓ Team: Madrid Hikers (3 members)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Firebase Emulator...');
  console.log(`   Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`   Auth:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

  try {
    const uids = await seedUsers();
    await seedMatches(uids);
    await seedConversations(uids);
    await seedPosts(uids);
    await seedTeams(uids);

    console.log('\n✅ Seed complete!');
    console.log('\nTest credentials (password for all: Test1234!)');
    console.log('  alice@test.com   — Premium, Madrid');
    console.log('  bob@test.com     — Free,    Barcelona');
    console.log('  carla@test.com   — VIP,     Valencia');
    console.log('  david@test.com   — Free,    Seville');
    console.log('  elena@test.com   — Premium, Madrid');
    console.log('  fran@test.com    — Free,    Barcelona');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
