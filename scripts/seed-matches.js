#!/usr/bin/env node
'use strict';
/**
 * Seed matches between real users and mock users.
 * Run: GOOGLE_APPLICATION_CREDENTIALS=... node scripts/seed-matches.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'loveisfamily-dev' });
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

// Real user IDs (fetched from Firestore above)
const REAL_USERS = [
  '5x5X9GW4wafvshcMlfQXOHeLZks2',
  '7ZEODkfmzWV9P37Rqz11LK4LRE92',
  'EE5KGxYm6rgPwXkITXPwF2qereL2',
  'EfJhc2ksTGZ4YuouJZjLQQz5DrD2',
  'OhTudLLADqUjzdWVccOJZNg3pir2',
  'cosdrp1MxOOjvwM8pIqLb2Bc4uj1',
  'kLC1WlfODiVVgJ8UsJJ0gki7wxz1',
  'lKtwTADNllbJqXVBZt5TdZcseef2',
  'rVtOA0WjR5awN1j5LSp8P1AsR883',
];

const MOCK_USERS = [
  'mock_user_001',
  'mock_user_002',
  'mock_user_003',
  'mock_user_004',
  'mock_user_005',
  'mock_user_006',
  'mock_user_007',
  'mock_user_008',
  'mock_user_009',
  'mock_user_010',
];

// Sample opening messages per mock user
const OPENING_MESSAGES = {
  mock_user_001: '¡Hola! Somos Laura y Sofía, dos mamás de Madrid. ¿Os apetece quedar algún sábado en el Retiro con los peques? 😊',
  mock_user_002: '¡Hola! Somos Carlos y Miguel desde Barcelona. ¡Encantados de conectar! ¿Os gusta el teatro o la música en directo?',
  mock_user_003: '¡Hola! Soy Ana, mamá soltera en Valencia. Me alegra mucho que conectemos. ¿Tenéis peques de edad similar?',
  mock_user_004: '¡Hola! Somos Mar y Paula 🌈 Tenemos una bebé de 1 año y un pug adorable. ¡Feliz de conoceros!',
  mock_user_005: '¡Hola familia! Somos una familia reconstituida de Sevilla. Cuatro peques en casa dan para mucho. ¿Vosotros cuántos tenéis?',
  mock_user_006: '¡Hola! Somos Irene y Julia con gemelos de 2 años 😅 El doble de caos pero el doble de amor. ¿Quedamos pronto?',
  mock_user_007: '¡Buenas! Somos Roberto y Javier desde Bilbao. ¿Conocéis algún libro bueno sobre diversidad familiar para niños?',
  mock_user_008: '¡Hola! Soy Elena. Mi hijo Mateo tiene 6 años y le encantan los juegos al aire libre. ¿Quedamos algún día?',
  mock_user_009: '¡Hola! Somos Noa y Sara de Vigo ☁️ Nos encantaría conocer más familias. ¿A qué os dedicáis?',
  mock_user_010: '¡Hola! Somos la familia de Marcos. ¿Os van los juegos de mesa? Tenemos una colección enorme 🎲',
};

function randomPastDate(daysAgo, hoursAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(d.getHours() - Math.floor(Math.random() * (hoursAgo || 1)));
  return admin.firestore.Timestamp.fromDate(d);
}

async function matchExists(u1, u2) {
  const [s1, s2] = await Promise.all([
    db.collection('matches').where('user1_id', '==', u1).where('user2_id', '==', u2).limit(1).get(),
    db.collection('matches').where('user1_id', '==', u2).where('user2_id', '==', u1).limit(1).get(),
  ]);
  return !s1.empty || !s2.empty;
}

async function createMutualMatch(realUserId, mockUserId, score) {
  if (await matchExists(realUserId, mockUserId)) {
    console.log(`   ↩ Match ya existe entre ${realUserId.slice(0, 8)} y ${mockUserId}`);
    return;
  }

  const matchRef = db.collection('matches').doc();
  const convRef = db.collection('conversations').doc();
  const msgRef = convRef.collection('messages').doc();
  const matchCreatedAt = randomPastDate(20);
  const msgCreatedAt = randomPastDate(15, 48);

  const batch = db.batch();

  // Match document
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  batch.set(matchRef, {
    id: matchRef.id,
    user1_id: realUserId,
    user2_id: mockUserId,
    compatibility_score: score,
    match_type: 'algorithm',
    status: 'mutual_match',
    conversation_id: convRef.id,
    created_at: matchCreatedAt,
    expires_at: Timestamp.fromDate(expiresAt),
    updated_at: matchCreatedAt,
  });

  // Conversation document
  const openingMsg = OPENING_MESSAGES[mockUserId] || '¡Hola! Me alegra que conectemos 😊';
  batch.set(convRef, {
    id: convRef.id,
    participant1_id: realUserId,
    participant2_id: mockUserId,
    last_message_text: openingMsg,
    last_message_timestamp: msgCreatedAt,
    unread_count_p1: 1,
    unread_count_p2: 0,
    created_at: matchCreatedAt,
    updated_at: msgCreatedAt,
    is_archived: false,
  });

  // Opening message from mock user
  batch.set(msgRef, {
    id: msgRef.id,
    sender_id: mockUserId,
    text: openingMsg,
    timestamp: msgCreatedAt,
    read: false,
  });

  await batch.commit();
  console.log(`   ✓ Match + conversación: ${realUserId.slice(0, 8)}... ↔ ${mockUserId} (score: ${score})`);
}

// Assign mock users to real users — each real user gets 3-5 mock matches
const ASSIGNMENTS = [
  // [realUserId, mockUserId, compatibilityScore]
  ['EE5KGxYm6rgPwXkITXPwF2qereL2', 'mock_user_001', 0.82],
  ['EE5KGxYm6rgPwXkITXPwF2qereL2', 'mock_user_004', 0.74],
  ['EE5KGxYm6rgPwXkITXPwF2qereL2', 'mock_user_006', 0.68],
  ['EE5KGxYm6rgPwXkITXPwF2qereL2', 'mock_user_010', 0.61],

  ['5x5X9GW4wafvshcMlfQXOHeLZks2', 'mock_user_002', 0.79],
  ['5x5X9GW4wafvshcMlfQXOHeLZks2', 'mock_user_005', 0.65],
  ['5x5X9GW4wafvshcMlfQXOHeLZks2', 'mock_user_007', 0.71],

  ['7ZEODkfmzWV9P37Rqz11LK4LRE92', 'mock_user_003', 0.76],
  ['7ZEODkfmzWV9P37Rqz11LK4LRE92', 'mock_user_008', 0.69],
  ['7ZEODkfmzWV9P37Rqz11LK4LRE92', 'mock_user_009', 0.58],

  ['EfJhc2ksTGZ4YuouJZjLQQz5DrD2', 'mock_user_001', 0.73],
  ['EfJhc2ksTGZ4YuouJZjLQQz5DrD2', 'mock_user_006', 0.80],
  ['EfJhc2ksTGZ4YuouJZjLQQz5DrD2', 'mock_user_010', 0.55],

  ['OhTudLLADqUjzdWVccOJZNg3pir2', 'mock_user_002', 0.85],
  ['OhTudLLADqUjzdWVccOJZNg3pir2', 'mock_user_004', 0.70],
  ['OhTudLLADqUjzdWVccOJZNg3pir2', 'mock_user_007', 0.63],
  ['OhTudLLADqUjzdWVccOJZNg3pir2', 'mock_user_009', 0.59],

  ['cosdrp1MxOOjvwM8pIqLb2Bc4uj1', 'mock_user_003', 0.77],
  ['cosdrp1MxOOjvwM8pIqLb2Bc4uj1', 'mock_user_005', 0.66],
  ['cosdrp1MxOOjvwM8pIqLb2Bc4uj1', 'mock_user_008', 0.72],

  ['kLC1WlfODiVVgJ8UsJJ0gki7wxz1', 'mock_user_001', 0.69],
  ['kLC1WlfODiVVgJ8UsJJ0gki7wxz1', 'mock_user_006', 0.75],
  ['kLC1WlfODiVVgJ8UsJJ0gki7wxz1', 'mock_user_010', 0.60],

  ['lKtwTADNllbJqXVBZt5TdZcseef2', 'mock_user_002', 0.78],
  ['lKtwTADNllbJqXVBZt5TdZcseef2', 'mock_user_004', 0.64],
  ['lKtwTADNllbJqXVBZt5TdZcseef2', 'mock_user_007', 0.81],

  ['rVtOA0WjR5awN1j5LSp8P1AsR883', 'mock_user_003', 0.70],
  ['rVtOA0WjR5awN1j5LSp8P1AsR883', 'mock_user_005', 0.67],
  ['rVtOA0WjR5awN1j5LSp8P1AsR883', 'mock_user_008', 0.74],
  ['rVtOA0WjR5awN1j5LSp8P1AsR883', 'mock_user_009', 0.62],
];

async function seed() {
  console.log('💘 Creando matches entre usuarios reales y mock...\n');

  for (const [realId, mockId, score] of ASSIGNMENTS) {
    await createMutualMatch(realId, mockId, score);
  }

  console.log(`\n✅ Listo. ${ASSIGNMENTS.length} matches procesados.`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
