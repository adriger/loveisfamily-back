#!/usr/bin/env node
'use strict';
/**
 * Seed script — inserta datos de prueba en Firestore.
 * Ejecutar: node scripts/seed-mock-data.js
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS o `firebase login`
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'loveisfamily-dev' });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

// ─── USUARIOS MOCK ───────────────────────────────────────────────────────────
const USERS = [
  {
    id: 'mock_user_001',
    email: 'laura.sofia@mock.test',
    username: 'lauraysofia',
    displayName: 'Laura y Sofía',
    bio: 'Dos mamás madrileñas con dos peques de 3 y 6 años. Buscamos familias para quedar en el parque y actividades de fin de semana.',
    photoURL: 'https://picsum.photos/seed/lif001a/400/400',
    photos: [
      'https://picsum.photos/seed/lif001a/400/400',
      'https://picsum.photos/seed/lif001b/400/400',
      'https://picsum.photos/seed/lif001c/400/400',
    ],
    age: 34,
    gender: null,
    interests: ['Parques y naturaleza', 'Deporte', 'Viajes', 'Gastronomía'],
    composition: { household: 'Dos madres', childrenAges: ['3-5 años', '6-9 años'], pets: [] },
    location: { latitude: 40.4168, longitude: -3.7038, city: 'Madrid' },
    subscription_type: 'free',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_002',
    email: 'carlos.miguel@mock.test',
    username: 'carlosymiguel',
    displayName: 'Carlos y Miguel',
    bio: 'Papás barceloneses con un niño de 4 años. Nos encanta la música, el teatro y los parques. ¡Quedamos cuando queráis!',
    photoURL: 'https://picsum.photos/seed/lif002a/400/400',
    photos: [
      'https://picsum.photos/seed/lif002a/400/400',
      'https://picsum.photos/seed/lif002b/400/400',
    ],
    age: 38,
    gender: null,
    interests: ['Música', 'Teatro', 'Parques y naturaleza', 'Cine y series'],
    composition: { household: 'Dos padres', childrenAges: ['3-5 años'], pets: ['Perro'] },
    location: { latitude: 41.3851, longitude: 2.1734, city: 'Barcelona' },
    subscription_type: 'premium',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_003',
    email: 'ana.torres@mock.test',
    username: 'anafamiliamonoparental',
    displayName: 'Ana y sus peques',
    bio: 'Mamá soltera con dos hijos de 7 y 10 años. Vivimos en Valencia y somos muy activos. Buscamos amigos para actividades al aire libre.',
    photoURL: 'https://picsum.photos/seed/lif003a/400/400',
    photos: [
      'https://picsum.photos/seed/lif003a/400/400',
      'https://picsum.photos/seed/lif003b/400/400',
      'https://picsum.photos/seed/lif003c/400/400',
    ],
    age: 41,
    gender: null,
    interests: ['Parques y naturaleza', 'Deporte', 'Lectura', 'Voluntariado'],
    composition: { household: 'Monoparental', childrenAges: ['6-9 años', '10-12 años'], pets: ['Gato'] },
    location: { latitude: 39.4699, longitude: -0.3763, city: 'Valencia' },
    subscription_type: 'free',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_004',
    email: 'mar.paula@mock.test',
    username: 'marypaula_bcn',
    displayName: 'Mar y Paula',
    bio: 'Familia arcoíris en Barcelona. Tenemos una bebé de 1 año y un pug que se llama Tofu. Buscamos otras familias diversas para compartir.',
    photoURL: 'https://picsum.photos/seed/lif004a/400/400',
    photos: [
      'https://picsum.photos/seed/lif004a/400/400',
      'https://picsum.photos/seed/lif004b/400/400',
      'https://picsum.photos/seed/lif004c/400/400',
      'https://picsum.photos/seed/lif004d/400/400',
    ],
    age: 31,
    gender: null,
    interests: ['Arte y manualidades', 'Gastronomía', 'Parques y naturaleza', 'Juegos de mesa'],
    composition: { household: 'Dos madres', childrenAges: ['0-2 años'], pets: ['Perro'] },
    location: { latitude: 41.3995, longitude: 2.1614, city: 'Barcelona' },
    subscription_type: 'vip',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_005',
    email: 'david.familia@mock.test',
    username: 'david_reconst',
    displayName: 'Familia Reconst. David',
    bio: 'Familia reconstituida con cuatro peques entre 5 y 13 años. Vivimos en Sevilla, somos muy deportistas y amantes de la naturaleza.',
    photoURL: 'https://picsum.photos/seed/lif005a/400/400',
    photos: [
      'https://picsum.photos/seed/lif005a/400/400',
      'https://picsum.photos/seed/lif005b/400/400',
    ],
    age: 44,
    gender: null,
    interests: ['Deporte', 'Parques y naturaleza', 'Viajes', 'Tecnología'],
    composition: { household: 'Familia reconstituida', childrenAges: ['3-5 años', '6-9 años', '10-12 años', '13+ años'], pets: [] },
    location: { latitude: 37.3891, longitude: -5.9845, city: 'Sevilla' },
    subscription_type: 'free',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_006',
    email: 'irene.julia@mock.test',
    username: 'ireneyjulia_mad',
    displayName: 'Irene y Julia',
    bio: 'Dos mamás con gemelos de 2 años. Estamos en el barrio de Malasaña. Nos encantan los mercadillos, la música y los niños creativos.',
    photoURL: 'https://picsum.photos/seed/lif006a/400/400',
    photos: [
      'https://picsum.photos/seed/lif006a/400/400',
      'https://picsum.photos/seed/lif006b/400/400',
      'https://picsum.photos/seed/lif006c/400/400',
    ],
    age: 36,
    gender: null,
    interests: ['Música', 'Arte y manualidades', 'Gastronomía', 'Cine y series'],
    composition: { household: 'Dos madres', childrenAges: ['0-2 años'], pets: ['Gato'] },
    location: { latitude: 40.4237, longitude: -3.7058, city: 'Madrid' },
    subscription_type: 'premium',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_007',
    email: 'roberto.javier@mock.test',
    username: 'robyjavi_bilbao',
    displayName: 'Roberto y Javier',
    bio: 'Papás en Bilbao con una hija de 8 años adoptada. Amamos los libros, la cocina vasca y los viajes. Siempre listos para hacer amigos.',
    photoURL: 'https://picsum.photos/seed/lif007a/400/400',
    photos: [
      'https://picsum.photos/seed/lif007a/400/400',
      'https://picsum.photos/seed/lif007b/400/400',
    ],
    age: 42,
    gender: null,
    interests: ['Lectura', 'Gastronomía', 'Viajes', 'Voluntariado'],
    composition: { household: 'Dos padres', childrenAges: ['6-9 años'], pets: [] },
    location: { latitude: 43.263, longitude: -2.935, city: 'Bilbao' },
    subscription_type: 'free',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_008',
    email: 'elena.mono@mock.test',
    username: 'elena_madrid_mama',
    displayName: 'Elena y Mateo',
    bio: 'Mamá soltera por elección con un hijo de 6 años. Somos muy activos y buscamos amigos para el cole y actividades extraescolares.',
    photoURL: 'https://picsum.photos/seed/lif008a/400/400',
    photos: [
      'https://picsum.photos/seed/lif008a/400/400',
      'https://picsum.photos/seed/lif008b/400/400',
      'https://picsum.photos/seed/lif008c/400/400',
    ],
    age: 39,
    gender: null,
    interests: ['Deporte', 'Juegos de mesa', 'Parques y naturaleza', 'Tecnología'],
    composition: { household: 'Monoparental', childrenAges: ['6-9 años'], pets: ['Pez'] },
    location: { latitude: 40.4093, longitude: -3.6821, city: 'Madrid' },
    subscription_type: 'free',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_009',
    email: 'noa.sara@mock.test',
    username: 'noaysara_vigo',
    displayName: 'Noa y Sara',
    bio: 'Familia en Vigo con tres gatos y una niña de 3 años. Nos encantan las manualidades, el teatro y los domingos en familia.',
    photoURL: 'https://picsum.photos/seed/lif009a/400/400',
    photos: [
      'https://picsum.photos/seed/lif009a/400/400',
      'https://picsum.photos/seed/lif009b/400/400',
    ],
    age: 33,
    gender: null,
    interests: ['Arte y manualidades', 'Teatro', 'Cine y series', 'Lectura'],
    composition: { household: 'Dos madres', childrenAges: ['3-5 años'], pets: ['Gato'] },
    location: { latitude: 42.2314, longitude: -8.7124, city: 'Vigo' },
    subscription_type: 'free',
    subscription_end_date: null,
  },
  {
    id: 'mock_user_010',
    email: 'marcos.fam@mock.test',
    username: 'marcos_otrasconf',
    displayName: 'La familia de Marcos',
    bio: 'Familia con dos papás y un donante conocido. Tenemos dos hijos de 4 y 9 años. Amamos los videojuegos, la ciencia y los parques tecnológicos.',
    photoURL: 'https://picsum.photos/seed/lif010a/400/400',
    photos: [
      'https://picsum.photos/seed/lif010a/400/400',
      'https://picsum.photos/seed/lif010b/400/400',
      'https://picsum.photos/seed/lif010c/400/400',
    ],
    age: 37,
    gender: null,
    interests: ['Tecnología', 'Juegos de mesa', 'Ciencia', 'Parques y naturaleza'],
    composition: { household: 'Otras configuraciones', childrenAges: ['3-5 años', '6-9 años'], pets: ['Roedor'] },
    location: { latitude: 40.4168, longitude: -3.7038, city: 'Madrid' },
    subscription_type: 'premium',
    subscription_end_date: null,
  },
];

// ─── POSTS MOCK ──────────────────────────────────────────────────────────────
const POSTS = [
  {
    author_id: 'mock_user_001',
    title: 'Rutas por el Retiro con peques',
    description: 'Hemos descubierto un circuito precioso alrededor del lago del Retiro que los niños adoran. Salimos todos los sábados a las 10:30. ¿Se apunta alguien más?',
    activity_type: 'sports',
    images: ['https://picsum.photos/seed/post001a/800/600', 'https://picsum.photos/seed/post001b/800/600'],
    tags: ['Retiro', 'Madrid', 'sábados'],
    likes_count: 8,
    comments_count: 3,
    location: { city: 'Madrid' },
    visibility: 'public',
    is_archived: false,
  },
  {
    author_id: 'mock_user_002',
    title: 'Grupo de teatro infantil en Gràcia',
    description: '¡Hola a todos! Hemos apuntado a nuestro hijo a un taller de teatro para niños de 3 a 8 años en el barrio de Gràcia. Es los sábados por la mañana y el ambiente es súper inclusivo. ¿Alguien más en Barcelona interesado?',
    activity_type: 'hobby',
    images: ['https://picsum.photos/seed/post002a/800/600'],
    tags: ['teatro', 'Barcelona', 'Gràcia', 'niños'],
    likes_count: 12,
    comments_count: 5,
    location: { city: 'Barcelona' },
    visibility: 'public',
    is_archived: false,
  },
  {
    author_id: 'mock_user_004',
    title: '¿Alguien conoce guarderías inclusivas en Barcelona?',
    description: 'Estamos buscando guardería para nuestra bebé de 10 meses. Queremos un ambiente diverso y respetuoso. Zona Eixample o Gràcia preferiblemente. ¡Cualquier recomendación es bienvenida!',
    activity_type: 'social',
    images: [],
    tags: ['guardería', 'Barcelona', 'inclusivo', 'recomendaciones'],
    likes_count: 6,
    comments_count: 7,
    location: { city: 'Barcelona' },
    visibility: 'public',
    is_archived: false,
  },
  {
    author_id: 'mock_user_006',
    title: 'Mercadillo de ropa infantil este domingo',
    description: 'Organizamos un mercadillo de intercambio de ropa infantil en Malasaña. Trae la ropa que ya no uses y llévate lo que necesites. Entrada libre, traed a los peques. ¡Es una oportunidad genial para conocer otras familias!',
    activity_type: 'social',
    images: ['https://picsum.photos/seed/post004a/800/600', 'https://picsum.photos/seed/post004b/800/600'],
    tags: ['mercadillo', 'ropa', 'Madrid', 'Malasaña', 'domingo'],
    likes_count: 23,
    comments_count: 11,
    location: { city: 'Madrid' },
    visibility: 'public',
    is_archived: false,
  },
  {
    author_id: 'mock_user_007',
    title: 'Recomendación: libro "Todas las familias" para peques',
    description: 'Hemos descubierto un libro precioso para explicar a los niños la diversidad familiar. Se llama "Todas las familias son especiales". Lo leemos cada noche y nuestra hija lo adora. Muy recomendable para niños de 3 a 8 años.',
    activity_type: 'hobby',
    images: ['https://picsum.photos/seed/post005a/800/600'],
    tags: ['libros', 'diversidad', 'familia', 'recomendación'],
    likes_count: 31,
    comments_count: 9,
    location: { city: 'Bilbao' },
    visibility: 'public',
    is_archived: false,
  },
  {
    author_id: 'mock_user_003',
    title: 'Excursión a la Albufera — familias de Valencia',
    description: 'Organizamos una excursión familiar a la Albufera el próximo mes. Barco por el lago, arrozal y comida juntos. Abierto a todas las familias. Máximo 5 familias para que sea más íntimo.',
    activity_type: 'sports',
    images: ['https://picsum.photos/seed/post006a/800/600', 'https://picsum.photos/seed/post006b/800/600'],
    tags: ['Valencia', 'excursión', 'naturaleza', 'Albufera'],
    likes_count: 15,
    comments_count: 6,
    location: { city: 'Valencia' },
    visibility: 'public',
    is_archived: false,
  },
  {
    author_id: 'mock_user_010',
    title: 'Tarde de juegos de mesa — ¿os animáis?',
    description: 'Buscamos familias para una tarde de juegos de mesa este sábado en casa. Tenemos Catan Junior, Dobble, Carcassonne… Los niños pueden jugar en el cuarto de juegos mientras los adultos echamos una partida aparte. En Madrid, zona norte.',
    activity_type: 'social',
    images: ['https://picsum.photos/seed/post007a/800/600'],
    tags: ['juegos', 'Madrid', 'sábado', 'plan'],
    likes_count: 18,
    comments_count: 4,
    location: { city: 'Madrid' },
    visibility: 'public',
    is_archived: false,
  },
];

// ─── SERVICIOS MOCK (si no existen ya) ───────────────────────────────────────
const SERVICES = [
  { name: 'Psicología Familiar LGBTI+', category: 'Salud', description: 'Terapia familiar y de pareja especializada en familias diversas.', city: 'Barcelona', schedule: 'Lunes a Viernes · 9:00-19:00', rating: 4.9, tags: ['Terapia', 'LGBTI+'], icon: '🧠', featured: true },
  { name: 'Despacho Arco Legal', category: 'Legal', description: 'Asesoría jurídica en adopción, custodia y derechos LGBTI+.', city: 'Madrid', schedule: 'Lunes a Viernes · 10:00-18:00', rating: 4.8, tags: ['Adopción', 'Custodia', 'Derechos'], icon: '⚖️', featured: true },
  { name: 'Guardería Arcoíris', category: 'Educación', description: 'Centro educativo inclusivo para peques de 0 a 6 años. Proyecto bilingüe y respetuoso.', city: 'Barcelona', schedule: 'Lunes a Viernes · 7:30-18:00', rating: 4.7, tags: ['0-6 años', 'Bilingüe', 'Inclusivo'], icon: '🎒', featured: false },
  { name: 'Club Familiar Diverso', category: 'Ocio', description: 'Actividades y eventos para familias LGBTI+ cada fin de semana en distintas ciudades.', city: 'Madrid', schedule: 'Sábados y Domingos · 10:00-19:00', rating: 4.6, tags: ['Eventos', 'Fin de semana', 'Familias'], icon: '🎪', featured: false },
  { name: 'Centro Bienestar Familia', category: 'Bienestar', description: 'Yoga familiar, mindfulness y talleres de crianza respetuosa para toda la familia.', city: 'Valencia', schedule: 'Martes a Domingo · 8:00-20:00', rating: 4.5, tags: ['Yoga', 'Mindfulness', 'Crianza'], icon: '🧘', featured: false },
  { name: 'Pediatría Inclusiva Dr. Ruiz', category: 'Salud', description: 'Equipo pediátrico con amplia experiencia en familias diversas y homoparentales.', city: 'Madrid', schedule: 'Lunes a Viernes · 9:00-17:00', rating: 4.9, tags: ['Pediatría', 'Homoparental'], icon: '👶', featured: true },
  { name: 'Escuela de Familias Arcoíris', category: 'Educación', description: 'Talleres y formación para madres y padres de familias diversas. Grupos reducidos.', city: 'Sevilla', schedule: 'Miércoles y Sábados · 10:00-14:00', rating: 4.4, tags: ['Talleres', 'Formación', 'Grupos'], icon: '📚', featured: false },
  { name: 'Fisioterapia Perinatal', category: 'Salud', description: 'Fisioterapia especializada en gestación subrogada, postparto y recuperación. Para todos los tipos de familia.', city: 'Barcelona', schedule: 'Lunes a Sábado · 9:00-20:00', rating: 4.7, tags: ['Postparto', 'Subrogación'], icon: '💆', featured: false },
  { name: 'Asesoría DINK & Rainbow Families', category: 'Legal', description: 'Especialistas en planificación fiscal y patrimonial para familias LGBTI+ y familias sin hijos.', city: 'Madrid', schedule: 'Lunes a Jueves · 10:00-18:00', rating: 4.6, tags: ['Fiscal', 'Patrimonio', 'Planificación'], icon: '📊', featured: false },
  { name: 'Parque Aventura Familiar', category: 'Ocio', description: 'Parque de actividades de aventura para familias. Tirolinas, escalada y circuitos para todas las edades.', city: 'Valencia', schedule: 'Todos los días · 10:00-20:00 (temporada)', rating: 4.3, tags: ['Aventura', 'Naturaleza', 'Niños'], icon: '🌲', featured: false },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function randomPastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  return admin.firestore.Timestamp.fromDate(d);
}

// ─── SEED ────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Iniciando seed de datos mock...\n');

  // 1. Usuarios
  console.log('👥 Insertando usuarios...');
  const userBatch = db.batch();
  for (const user of USERS) {
    const ref = db.collection('users').doc(user.id);
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`   ↩ ${user.displayName} ya existe, saltando`);
      continue;
    }
    userBatch.set(ref, {
      ...user,
      subscription_type: user.subscription_type || 'free',
      created_at: randomPastDate(60),
      updated_at: randomPastDate(7),
    });
    // Límites de usuario
    const limitsRef = db.collection('user_limits').doc(user.id);
    userBatch.set(limitsRef, {
      matches_today: 0,
      teams_created_month: 0,
      posts_today: 0,
      last_match_reset_date: FieldValue.serverTimestamp(),
      last_team_reset_date: FieldValue.serverTimestamp(),
      last_post_reset_date: FieldValue.serverTimestamp(),
      subscription_tier: user.subscription_type || 'free',
    });
    console.log(`   ✓ ${user.displayName}`);
  }
  await userBatch.commit();

  // 2. Posts
  console.log('\n📝 Insertando posts...');
  const existing = await db.collection('posts').where('author_id', 'in', USERS.map(u => u.id)).limit(1).get();
  if (!existing.empty) {
    console.log('   ↩ Posts ya existen, saltando');
  } else {
    const postBatch = db.batch();
    for (const post of POSTS) {
      const ref = db.collection('posts').doc();
      postBatch.set(ref, {
        id: ref.id,
        ...post,
        created_at: randomPastDate(30),
        updated_at: randomPastDate(5),
      });
      console.log(`   ✓ "${post.title}"`);
    }
    await postBatch.commit();
  }

  // 3. Servicios
  console.log('\n🏪 Verificando servicios...');
  const svcSnap = await db.collection('services').limit(1).get();
  if (!svcSnap.empty) {
    console.log(`   ↩ Servicios ya existen, saltando`);
  } else {
    const svcBatch = db.batch();
    for (const svc of SERVICES) {
      const ref = db.collection('services').doc();
      svcBatch.set(ref, {
        ...svc,
        archived: false,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${svc.name}`);
    }
    await svcBatch.commit();
  }

  console.log('\n✅ Seed completado.');
  console.log(`   ${USERS.length} usuarios | ${POSTS.length} posts | ${SERVICES.length} servicios`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
