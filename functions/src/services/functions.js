'use strict';
const { FieldValue } = require('@google-cloud/firestore');
const admin = require('firebase-admin');
const { ERROR_CODES } = require('../shared/constants');

const db = admin.firestore();

async function getServices({ category, search, limit = 50 } = {}) {
  let query = db.collection('services')
    .where('archived', '==', false)
    .orderBy('featured', 'desc')
    .orderBy('name', 'asc')
    .limit(limit);

  if (category && category !== 'Todos') {
    query = db.collection('services')
      .where('archived', '==', false)
      .where('category', '==', category)
      .orderBy('featured', 'desc')
      .orderBy('name', 'asc')
      .limit(limit);
  }

  const snap = await query.get();
  let services = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (search) {
    const s = search.toLowerCase();
    services = services.filter(svc =>
      svc.name?.toLowerCase().includes(s) ||
      (svc.tags || []).some(t => t.toLowerCase().includes(s))
    );
  }

  return services;
}

async function createReservation(userId, { serviceId, userName, userPhone, requestedDate, notes }) {
  if (!userId) throw { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' };
  if (!serviceId || !userName || !userPhone || !requestedDate) {
    throw { code: ERROR_CODES.INVALID_INPUT, message: 'Faltan campos obligatorios' };
  }

  const serviceDoc = await db.collection('services').doc(serviceId).get();
  if (!serviceDoc.exists) throw { code: ERROR_CODES.NOT_FOUND, message: 'Servicio no encontrado' };

  const userDoc = await db.collection('users').doc(userId).get();
  const userEmail = userDoc.exists ? userDoc.data().email : '';

  const ref = db.collection('reservations').doc();
  await ref.set({
    id: ref.id,
    service_id: serviceId,
    service_name: serviceDoc.data().name,
    user_id: userId,
    user_name: userName,
    user_phone: userPhone,
    user_email: userEmail,
    requested_date: requestedDate,
    notes: notes || '',
    status: 'pending',
    confirmed_datetime: null,
    cancel_reason: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  return { reservationId: ref.id };
}

async function getUserReservations(userId) {
  if (!userId) throw { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' };

  const snap = await db.collection('reservations')
    .where('user_id', '==', userId)
    .orderBy('created_at', 'desc')
    .limit(50)
    .get();

  return snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    created_at: d.data().created_at?.toDate?.()?.toISOString() ?? null,
    updated_at: d.data().updated_at?.toDate?.()?.toISOString() ?? null,
    confirmed_datetime: d.data().confirmed_datetime?.toDate?.()?.toISOString() ?? null,
  }));
}

module.exports = { getServices, createReservation, getUserReservations };
