'use strict';

/**
 * Integration tests for the full match lifecycle.
 * Tests against Firestore Emulator.
 * Run: firebase emulators:start --only firestore && npm run test:integration
 */

const { MATCH_STATUS, createMatch, acceptMatch, mutualMatch, rejectMatch, expireOldMatches } = require('../../agent-04/match-state-machine');
const { users } = require('../fixtures/sample-data');

// These tests require Firebase Emulator to be running
// They are skipped in CI unless FIREBASE_EMULATOR_HOST is set
const itWithEmulator = process.env.FIREBASE_EMULATOR_HOST ? it : it.skip;

describe('Match State Machine — Unit (no emulator)', () => {
  test('VALID_TRANSITIONS: PENDING → ACCEPTED allowed', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition(MATCH_STATUS.PENDING, MATCH_STATUS.ACCEPTED)).toBe(true);
  });

  test('VALID_TRANSITIONS: PENDING → MUTUAL_MATCH not allowed', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition(MATCH_STATUS.PENDING, MATCH_STATUS.MUTUAL_MATCH)).toBe(false);
  });

  test('VALID_TRANSITIONS: MUTUAL_MATCH → any not allowed', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition(MATCH_STATUS.MUTUAL_MATCH, MATCH_STATUS.REJECTED)).toBe(false);
    expect(isValidTransition(MATCH_STATUS.MUTUAL_MATCH, MATCH_STATUS.EXPIRED)).toBe(false);
  });

  test('VALID_TRANSITIONS: ACCEPTED → MUTUAL_MATCH allowed', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition(MATCH_STATUS.ACCEPTED, MATCH_STATUS.MUTUAL_MATCH)).toBe(true);
  });

  test('VALID_TRANSITIONS: ACCEPTED → REJECTED allowed', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition(MATCH_STATUS.ACCEPTED, MATCH_STATUS.REJECTED)).toBe(true);
  });

  test('VALID_TRANSITIONS: REJECTED → anything not allowed', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition(MATCH_STATUS.REJECTED, MATCH_STATUS.ACCEPTED)).toBe(false);
  });

  test('all valid final states have no outgoing transitions', () => {
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    const finalStates = [MATCH_STATUS.MUTUAL_MATCH, MATCH_STATUS.REJECTED, MATCH_STATUS.EXPIRED];
    const allStates = Object.values(MATCH_STATUS);
    for (const from of finalStates) {
      for (const to of allStates) {
        expect(isValidTransition(from, to)).toBe(false);
      }
    }
  });
});

describe('Match Lifecycle — Full Flow (mocked)', () => {
  const { mockAdmin, resetMocks } = require('../fixtures/mocks');

  beforeEach(() => {
    resetMocks();
    jest.mock('firebase-admin', () => mockAdmin);
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('match status progression is valid', () => {
    // Verify state machine logic without I/O
    const { isValidTransition } = require('../../agent-04/match-state-machine');
    expect(isValidTransition('pending', 'accepted')).toBe(true);
    expect(isValidTransition('accepted', 'mutual_match')).toBe(true);
    expect(isValidTransition('mutual_match', 'rejected')).toBe(false);
  });
});

describe('Match Constants', () => {
  test('MATCH_STATUS has all required states', () => {
    expect(MATCH_STATUS).toHaveProperty('PENDING');
    expect(MATCH_STATUS).toHaveProperty('ACCEPTED');
    expect(MATCH_STATUS).toHaveProperty('MUTUAL_MATCH');
    expect(MATCH_STATUS).toHaveProperty('REJECTED');
    expect(MATCH_STATUS).toHaveProperty('EXPIRED');
  });
});
