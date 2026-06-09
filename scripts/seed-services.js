#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const SERVICES = [
  { name: 'Psicología Familiar LGBTI+', category: 'Salud', description: 'Terapia familiar y de pareja especializada en familias diversas.', city: 'Barcelona', address: 'Carrer de Provença 123, Barcelona', rating: 4.9, tags: ['Terapia', 'Familias'], icon: '🧠', schedule: 'Lunes a Viernes · 9:00 - 19:00', featured: true },
  { name: 'Despacho Arco Legal', category: 'Legal', description: 'Asesoría jurídica en adopción, custodia y derechos LGBTI+.', city: 'Barcelona', address: 'Gran Via de les Corts Catalanes 456, Barcelona', rating: 4.8, tags: ['Adopción', 'Custodia'], icon: '⚖️', schedule: 'Lunes a Viernes · 10:00 - 18:00', featured: true },
  { name: 'Guardería Arcoíris', category: 'Educación', description: 'Centro educativo inclusivo para peques de 0 a 6 años.', city: 'Gràcia', address: 'Carrer de Verdi 78, Barcelona', rating: 4.7, tags: ['0-6 años', 'Inclusivo'], icon: '🎒', schedule: 'Lunes a Viernes · 7:30 - 18:00', featured: false },
  { name: 'Club Familiar Diverso', category: 'Ocio', description: 'Actividades y eventos para familias diversas cada fin de semana.', city: 'Poble Sec', address: 'Carrer de Blai 34, Barcelona', rating: 4.6, tags: ['Eventos', 'Fin de semana'], icon: '🎪', schedule: 'Sábados y Domingos · 10:00 - 19:00', featured: false },
  { name: 'Centro de Bienestar Familia', category: 'Bienestar', description: 'Yoga familiar, meditación y talleres para toda la familia.', city: 'Eixample', address: 'Carrer del Consell de Cent 200, Barcelona', rating: 4.5, tags: ['Yoga', 'Talleres'], icon: '🧘', schedule: 'Martes a Domingo · 8:00 - 20:00', featured: false },
  { name: 'Pediatría Inclusiva', category: 'Salud', description: 'Equipo pediátrico con experiencia en familias diversas y homoparentales.', city: 'Sant Martí', address: 'Rambla del Poblenou 45, Barcelona', rating: 4.9, tags: ['Pediatría', 'Homoparental'], icon: '👶', schedule: 'Lunes a Viernes · 9:00 - 17:00', featured: true },
  { name: 'Escuela de Familias', category: 'Educación', description: 'Talleres y formación para madres y padres de familias diversas.', city: 'Horta', address: 'Passeig de Maragall 89, Barcelona', rating: 4.4, tags: ['Talleres', 'Formación'], icon: '📚', schedule: 'Miércoles y Sábados · 10:00 - 14:00', featured: false },
];

async function seed() {
  const batch = db.batch();
  for (const svc of SERVICES) {
    const ref = db.collection('services').doc();
    batch.set(ref, {
      ...svc,
      archived: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`✓ Seeded ${SERVICES.length} services`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
