'use strict';

/**
 * Mock Firebase Admin SDK for unit tests.
 * Provides in-memory Firestore and Auth simulacra.
 */

const mockDb = new Map();
const mockAuthUsers = new Map();

const mockFirestore = {
  collection: (name) => ({
    doc: (id) => ({
      get: async () => {
        const key = `${name}/${id}`;
        const data = mockDb.get(key);
        return { exists: !!data, data: () => data, id, ref: { update: jest.fn(), set: jest.fn(), delete: jest.fn() } };
      },
      set: async (data, opts) => {
        const key = `${name}/${id}`;
        const existing = mockDb.get(key) || {};
        mockDb.set(key, opts?.merge ? { ...existing, ...data } : data);
      },
      update: async (data) => {
        const key = `${name}/${id}`;
        const existing = mockDb.get(key) || {};
        mockDb.set(key, { ...existing, ...data });
      },
      delete: async () => mockDb.delete(`${name}/${id}`),
      collection: (sub) => mockFirestore.collection(`${name}/${id}/${sub}`),
    }),
    add: async (data) => {
      const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      mockDb.set(`${name}/${id}`, data);
      return { id };
    },
    where: () => ({
      where: () => ({ get: async () => ({ docs: [], empty: true, size: 0 }), limit: () => ({ get: async () => ({ docs: [], empty: true }) }) }),
      get: async () => ({ docs: [], empty: true, size: 0 }),
      limit: (n) => ({ get: async () => ({ docs: [], empty: true }) }),
      orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }),
    }),
    get: async () => ({ docs: [], empty: true, size: 0 }),
  }),
  runTransaction: async (fn) => fn({
    get: async (ref) => ref.get(),
    set: (ref, data, opts) => ref.set(data, opts),
    update: (ref, data) => ref.update(data),
    delete: (ref) => ref.delete(),
  }),
  batch: () => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  }),
  collectionGroup: () => ({
    where: () => ({ get: async () => ({ docs: [] }) }),
  }),
};

const mockAuth = {
  createUser: jest.fn().mockResolvedValue({ uid: 'mock_uid_123' }),
  deleteUser: jest.fn().mockResolvedValue(undefined),
  updateUser: jest.fn().mockResolvedValue(undefined),
  getUser: jest.fn().mockResolvedValue({ uid: 'mock_uid_123', customClaims: {} }),
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
  verifyIdToken: jest.fn().mockResolvedValue({ uid: 'mock_uid_123', email_verified: true }),
  generatePasswordResetLink: jest.fn().mockResolvedValue('https://reset.link/token'),
};

const mockMessaging = {
  send: jest.fn().mockResolvedValue('message_id'),
  sendMulticast: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0 }),
};

const mockAdmin = {
  firestore: jest.fn(() => mockFirestore),
  auth: jest.fn(() => mockAuth),
  messaging: jest.fn(() => mockMessaging),
  apps: [{}],
  initializeApp: jest.fn(),
};

mockAdmin.firestore.Timestamp = {
  now: () => ({ toMillis: () => Date.now() }),
  fromDate: (d) => ({ toMillis: () => d.getTime() }),
  fromMillis: (ms) => ({ toMillis: () => ms }),
};
mockAdmin.firestore.FieldValue = {
  serverTimestamp: () => new Date(),
  increment: (n) => n,
  arrayUnion: (...items) => items,
  arrayRemove: (...items) => items,
};

function resetMocks() {
  mockDb.clear();
  mockAuthUsers.clear();
  jest.clearAllMocks();
}

module.exports = { mockAdmin, mockFirestore, mockAuth, mockMessaging, resetMocks };
