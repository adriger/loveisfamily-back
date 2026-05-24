'use strict';

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

let testEnv;

/**
 * Initializes the Firebase Emulator test environment.
 * Call before test suite begins.
 */
async function setupTestEnvironment(projectId = 'test-project') {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: 'localhost',
      port: 8080,
    },
  });
  return testEnv;
}

/**
 * Clears the Firestore emulator database between test suites.
 */
async function clearDatabase() {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
}

/**
 * Tears down the test environment.
 */
async function teardownTestEnvironment() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

/**
 * Returns an authenticated Firestore context for a user.
 * @param {string} userId
 * @param {object} customClaims
 */
function getAuthContext(userId, customClaims = {}) {
  return testEnv.authenticatedContext(userId, {
    email_verified: true,
    subscription_type: 'free',
    ...customClaims,
  });
}

/**
 * Returns an unauthenticated Firestore context.
 */
function getUnauthContext() {
  return testEnv.unauthenticatedContext();
}

/**
 * Seeds the test database with sample data.
 * @param {object} data - { users?, matches?, conversations? }
 */
async function seedDatabase(data = {}) {
  if (!testEnv) throw new Error('Test environment not initialized');

  const db = testEnv.authenticatedContext('admin', { admin: true }).firestore();

  const batch = db.batch();

  (data.users || []).forEach(user => {
    batch.set(db.collection('users').doc(user.id), user);
  });
  (data.matches || []).forEach(match => {
    batch.set(db.collection('matches').doc(match.id), match);
  });
  (data.conversations || []).forEach(conv => {
    batch.set(db.collection('conversations').doc(conv.id), conv);
  });

  await batch.commit();
}

module.exports = {
  setupTestEnvironment,
  clearDatabase,
  teardownTestEnvironment,
  getAuthContext,
  getUnauthContext,
  seedDatabase,
  assertFails,
  assertSucceeds,
};
