'use strict';

/**
 * End-to-end smoke tests against the Functions emulator.
 * Calls each Cloud Function via the Firebase callable SDK and reports pass/fail.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost:5001 \
 *   node scripts/test-functions.js
 */

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Use node-fetch compatible approach via Firebase REST API for callable functions
const http = require('http');

const PROJECT_ID = 'loveisfamily-dev';
const FUNCTIONS_HOST = 'localhost';
const FUNCTIONS_PORT = 5001;
const AUTH_HOST = 'localhost';
const AUTH_PORT = 9099;

// ── Minimal HTTP helpers ──────────────────────────────────────────────────────

function post(host, port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host,
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Sign in with emulator REST API to get an ID token
async function signIn(email, password) {
  const res = await post(
    AUTH_HOST, AUTH_PORT,
    `/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`,
    { email, password, returnSecureToken: true }
  );
  if (!res.body.idToken) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body.idToken;
}

// Call a Cloud Function (HTTPS callable format)
async function callFn(name, data, idToken = null) {
  const headers = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await post(
    FUNCTIONS_HOST, FUNCTIONS_PORT,
    `/${PROJECT_ID}/us-central1/${name}`,
    { data },
    headers
  );
  return res;
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log(`✗ FAIL — ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n── Auth Functions ──');

  let aliceToken, bobToken, newUid;
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6); // last 6 digits to stay under 20 chars
  const newEmail = `newuser_${shortId}@test.com`;

  await test('createUser — new account', async () => {
    const res = await callFn('createUser', {
      email: newEmail,
      password: 'Test1234!',
      username: `newuser_${shortId}`,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.result && res.body.result.uid, 'Expected uid in result');
    newUid = res.body.result.uid;
  });

  await test('createUser — duplicate email rejected', async () => {
    const res = await callFn('createUser', {
      email: newEmail,
      password: 'Test1234!',
      username: `dup_${shortId}`,
    });
    assert(res.status !== 200 || res.body.error, 'Expected error for duplicate email');
  });

  await test('sign in as alice', async () => {
    aliceToken = await signIn('alice@test.com', 'Test1234!');
    assert(aliceToken, 'Expected token');
  });

  await test('sign in as bob', async () => {
    bobToken = await signIn('bob@test.com', 'Test1234!');
    assert(bobToken, 'Expected token');
  });

  await test('updateUserProfile — requires auth', async () => {
    const res = await callFn('updateUserProfile', { displayName: 'Alice Updated' });
    assert(res.body.error || res.status === 401, 'Expected unauthenticated error');
  });

  await test('updateUserProfile — authenticated', async () => {
    const res = await callFn('updateUserProfile', {
      displayName: 'Alice Updated',
      bio: 'Love hiking and cooking!',
    }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  console.log('\n── Matching Functions ──');

  await test('getMatchingSuggestions — requires auth', async () => {
    const res = await callFn('getMatchingSuggestions', { limit: 5 });
    assert(res.body.error || res.status === 401, 'Expected unauthenticated error');
  });

  await test('getMatchingSuggestions — returns suggestions', async () => {
    const res = await callFn('getMatchingSuggestions', { limit: 5 }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(Array.isArray(res.body.result), 'Expected array of suggestions');
    console.log(`\n       → ${res.body.result.length} suggestions returned`);
  });

  await test('createMatch — initiates a match', async () => {
    const admin = require('firebase-admin');
    // Use fran (no existing match with alice) as the target
    const franUser = await admin.auth().getUserByEmail('fran@test.com');
    const res = await callFn('createMatch', {
      targetUserId: franUser.uid,
      matchType: 'instant',
    }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.result && res.body.result.matchId, 'Expected matchId');
    console.log(`\n       → matchId: ${res.body.result.matchId}`);
  });

  await test('getMatchHistory — returns history', async () => {
    const res = await callFn('getMatchHistory', { limit: 10 }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.result && Array.isArray(res.body.result.matches), `Expected {matches:[...]} got: ${JSON.stringify(res.body.result)}`);
    console.log(`\n       → ${res.body.result.matches.length} matches in history`);
  });

  console.log('\n── Community Functions ──');

  let postId;

  await test('createPost — creates a post', async () => {
    const res = await callFn('createPost', {
      title: 'Test hike this Sunday',
      description: 'Anyone want to join a 10km hike?',
      activityType: 'sports',
      tags: ['hiking', 'weekend'],
      visibility: 'public',
    }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.result && res.body.result.postId, 'Expected postId');
    postId = res.body.result.postId;
    console.log(`\n       → postId: ${postId}`);
  });

  await test('getPostFeed — returns posts', async () => {
    const res = await callFn('getPostFeed', { limit: 10 }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.result && Array.isArray(res.body.result.posts), `Expected {posts:[...]} got: ${JSON.stringify(res.body.result)}`);
    console.log(`\n       → ${res.body.result.posts.length} posts in feed`);
  });

  await test('likePost — likes a post', async () => {
    if (!postId) { throw new Error('No postId from createPost'); }
    const res = await callFn('likePost', { postId }, bobToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await test('commentOnPost — adds comment', async () => {
    if (!postId) { throw new Error('No postId from createPost'); }
    const res = await callFn('commentOnPost', {
      postId,
      text: 'Count me in! What time?',
    }, bobToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  console.log('\n── Messaging Functions ──');

  await test('getConversations — returns list', async () => {
    const res = await callFn('getConversations', {}, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(Array.isArray(res.body.result), 'Expected array');
    console.log(`\n       → ${res.body.result.length} conversations`);
  });

  console.log('\n── Teams Functions ──');

  let teamId;

  await test('createTeam — VIP user creates team', async () => {
    const carlaToken = await signIn('carla@test.com', 'Test1234!');
    const res = await callFn('createTeam', {
      name: `Test Team ${timestamp}`,
      description: 'A test team for outdoor activities',
      privacyType: 'public',
    }, carlaToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.result && res.body.result.teamId, 'Expected teamId');
    teamId = res.body.result.teamId;
    console.log(`\n       → teamId: ${teamId}`);
  });

  await test('createTeam — free user blocked', async () => {
    const res = await callFn('createTeam', {
      name: `Free Team ${timestamp}`,
      description: 'Should be blocked',
      privacyType: 'public',
    }, bobToken);
    // Free tier has 0 teams — should get SUBSCRIPTION_REQUIRED error
    assert(
      res.body.error || (res.body.result && res.body.result.error),
      `Expected subscription error, got: ${JSON.stringify(res.body)}`
    );
  });

  console.log('\n── Freemium Functions ──');

  await test('checkSubscriptionLimits — returns limits', async () => {
    const res = await callFn('checkSubscriptionLimits', { feature: 'matches' }, aliceToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    console.log(`\n       → ${JSON.stringify(res.body.result)}`);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Need admin SDK for uid lookups during tests
  const admin = require('firebase-admin');
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  console.log('🧪 Running function smoke tests against emulators...');

  await runTests();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed — check function logs in the emulator UI at http://localhost:4000');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
