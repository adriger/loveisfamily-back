'use strict';

/**
 * Seed script — limpia toda la base de datos y genera 20 familias mock.
 * Uso: node scripts/seed.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/adrian/Downloads/loveisfamily-dev-firebase-adminsdk-fbsvc-5a21aff427.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();
const db = admin.firestore();
const { FieldValue } = require('@google-cloud/firestore');

// ── Helpers ──────────────────────────────────────────────────────────────────

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndMany(arr, min, max) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, min + Math.floor(Math.random() * (max - min + 1)));
}
const now = new Date().toISOString();

// ── Datos base ────────────────────────────────────────────────────────────────

const CITIES = {
  madrid:    { city: 'Madrid',    latitude: 40.4168, longitude: -3.7038 },
  barcelona: { city: 'Barcelona', latitude: 41.3851, longitude: 2.1734  },
  valencia:  { city: 'Valencia',  latitude: 39.4699, longitude: -0.3763 },
  sevilla:   { city: 'Sevilla',   latitude: 37.3891, longitude: -5.9845 },
  bilbao:    { city: 'Bilbao',    latitude: 43.2630, longitude: -2.9350 },
  malaga:    { city: 'Málaga',    latitude: 36.7213, longitude: -4.4214 },
  zaragoza:  { city: 'Zaragoza',  latitude: 41.6488, longitude: -0.8891 },
};

const ALL_INTERESTS = [
  'Parques y naturaleza', 'Deporte', 'Arte y manualidades', 'Música',
  'Viajes', 'Gastronomía', 'Lectura', 'Cine y series',
  'Juegos de mesa', 'Voluntariado', 'Teatro', 'Tecnología',
];

// i.pravatar.cc devuelve avatares consistentes por número
const photo = (n) => `https://i.pravatar.cc/400?img=${n}`;

// ── 20 familias mock ──────────────────────────────────────────────────────────

const FAMILIES = [
  {
    email: 'sofia.garcia@mock.lif', password: 'Mock1234!',
    username: 'sofia_garcia', displayName: 'Sofía y Andrea',
    photoURL: photo(1), photos: [photo(1), photo(11)], age: 34,
    bio: 'Dos mamás madrileñas con dos peques revoltosos y mucho amor que dar. Buscamos familias con las que compartir tardes de parque y alguna escapada.',
    composition: { household: 'Dos madres', childrenAges: ['3-5 años', '6-9 años'], pets: ['Perro'] },
    interests: ['Parques y naturaleza', 'Arte y manualidades', 'Viajes'],
    location: CITIES.madrid,
  },
  {
    email: 'carlos.martinez@mock.lif', password: 'Mock1234!',
    username: 'carlos_david', displayName: 'Carlos y David',
    photoURL: photo(2), photos: [photo(2), photo(12)], age: 31,
    bio: 'Papás primerizos en Barcelona. Nuestro bebé de 8 meses nos tiene sin dormir pero con la sonrisa siempre puesta. Queremos conectar con otras familias del barrio.',
    composition: { household: 'Dos padres', childrenAges: ['0-2 años'] },
    interests: ['Deporte', 'Música', 'Gastronomía'],
    location: CITIES.barcelona,
  },
  {
    email: 'laura.fernandez@mock.lif', password: 'Mock1234!',
    username: 'laura_fer', displayName: 'Laura Fernández',
    photoURL: photo(3), photos: [photo(3)], age: 38,
    bio: 'Mamá en solitario y orgullosa. Mi hija de 7 años es mi vida entera. Busco familia con la que hacer planes de fin de semana y que los peques tengan compañía.',
    composition: { household: 'Monoparental', childrenAges: ['6-9 años'] },
    interests: ['Lectura', 'Cine y series', 'Parques y naturaleza'],
    location: CITIES.valencia,
  },
  {
    email: 'miguel.torres@mock.lif', password: 'Mock1234!',
    username: 'miguel_javi', displayName: 'Miguel y Javier',
    photoURL: photo(4), photos: [photo(4), photo(14)], age: 40,
    bio: 'Familia sevillana con gemelos de 4 años que son un torbellino de energía. Nos encanta la gastronomía y los viajes cortos.',
    composition: { household: 'Dos padres', childrenAges: ['3-5 años'], pets: ['Perro'] },
    interests: ['Gastronomía', 'Viajes', 'Deporte'],
    location: CITIES.sevilla,
  },
  {
    email: 'ana.jimenez@mock.lif', password: 'Mock1234!',
    username: 'ana_patricia', displayName: 'Ana e Isabel',
    photoURL: photo(5), photos: [photo(5), photo(15)], age: 29,
    bio: 'Vivimos en Bilbao y aún no tenemos peques, pero estamos en proceso de adopción. Nos encantaría relacionarnos con otras familias diversas mientras esperamos.',
    composition: { household: 'Dos madres' },
    interests: ['Voluntariado', 'Teatro', 'Música'],
    location: CITIES.bilbao,
  },
  {
    email: 'roberto.diaz@mock.lif', password: 'Mock1234!',
    username: 'roberto_diaz', displayName: 'Roberto Díaz',
    photoURL: photo(6), photos: [photo(6)], age: 43,
    bio: 'Papá solo con mi hijo de 11 años, jugador de fútbol en ciernes. Trabajamos en equipo desde que su madre falleció hace tres años. Buscamos amigos para los dos.',
    composition: { household: 'Monoparental', childrenAges: ['10-12 años'] },
    interests: ['Deporte', 'Tecnología', 'Juegos de mesa'],
    location: CITIES.madrid,
  },
  {
    email: 'carmen.lopez@mock.lif', password: 'Mock1234!',
    username: 'carmen_patricia', displayName: 'Carmen y Patricia',
    photoURL: photo(7), photos: [photo(7), photo(17)], age: 32,
    bio: 'Familia en el barrio de Malasaña. Tenemos dos niñas, una de 1 año y otra de 4, y un gato que manda en casa. Planes tranquilos y mucho cariño.',
    composition: { household: 'Dos madres', childrenAges: ['0-2 años', '3-5 años'], pets: ['Gato'] },
    interests: ['Parques y naturaleza', 'Arte y manualidades', 'Cine y series'],
    location: CITIES.madrid,
  },
  {
    email: 'alejandro.martin@mock.lif', password: 'Mock1234!',
    username: 'ale_sergio', displayName: 'Alejandro y Sergio',
    photoURL: photo(8), photos: [photo(8), photo(18)], age: 37,
    bio: 'Dos papás deportistas con hijos que van al cole juntos. El mayor ya lleva camiseta del Barça y el pequeño prefiere los libros. Vivimos en Gràcia.',
    composition: { household: 'Dos padres', childrenAges: ['6-9 años', '10-12 años'] },
    interests: ['Deporte', 'Lectura', 'Viajes'],
    location: CITIES.barcelona,
  },
  {
    email: 'marta.alonso@mock.lif', password: 'Mock1234!',
    username: 'marta_alonso', displayName: 'Marta Alonso',
    photoURL: photo(9), photos: [photo(9)], age: 35,
    bio: 'Artista y mamá en Valencia. Mi peque de 4 años ya pinta mejor que yo. Buscamos familia creativa para talleres, museos y tardes en el jardín.',
    composition: { household: 'Monoparental', childrenAges: ['3-5 años'] },
    interests: ['Arte y manualidades', 'Música', 'Teatro'],
    location: CITIES.valencia,
  },
  {
    email: 'luis.garcia@mock.lif', password: 'Mock1234!',
    username: 'luis_marcos', displayName: 'Luis y Marcos',
    photoURL: photo(10), photos: [photo(10), photo(20)], age: 45,
    bio: 'Ingenieros y papás de un adolescente de 15 años muy independiente. Queremos conectar con familias para actividades que no nos hagan sentir viejos.',
    composition: { household: 'Dos padres', childrenAges: ['13+ años'] },
    interests: ['Tecnología', 'Cine y series', 'Gastronomía'],
    location: CITIES.madrid,
  },
  {
    email: 'elena.ramos@mock.lif', password: 'Mock1234!',
    username: 'elena_nuria', displayName: 'Elena y Nuria',
    photoURL: photo(21), photos: [photo(21), photo(31)], age: 28,
    bio: 'Recién llegadas a Málaga con nuestra bebé de 6 meses. Aún no conocemos a nadie en la ciudad y queremos hacer amigos familia desde el principio.',
    composition: { household: 'Dos madres', childrenAges: ['0-2 años'] },
    interests: ['Parques y naturaleza', 'Gastronomía', 'Música'],
    location: CITIES.malaga,
  },
  {
    email: 'familia.rodriguez@mock.lif', password: 'Mock1234!',
    username: 'fam_rodriguez', displayName: 'Familia Rodríguez-Vega',
    photoURL: photo(22), photos: [photo(22)], age: 41,
    bio: 'Familia reconstituida con 4 hijos entre los dos. Hay días de caos total, pero también momentos mágicos. Buscamos otras familias grandes con las que compartir la locura.',
    composition: { household: 'Familia reconstituida', childrenAges: ['6-9 años', '10-12 años'], pets: ['Perro', 'Gato'] },
    interests: ['Cine y series', 'Teatro', 'Parques y naturaleza'],
    location: CITIES.barcelona,
  },
  {
    email: 'beatriz.moreno@mock.lif', password: 'Mock1234!',
    username: 'bea_moreno', displayName: 'Beatriz Moreno',
    photoURL: photo(23), photos: [photo(23)], age: 33,
    bio: 'Madrileña, cocinera aficionada y mamá de una niña de 4 años que ya sabe más recetas que yo. Los fines de semana los llenamos de mercados, cocina y naturaleza.',
    composition: { household: 'Monoparental', childrenAges: ['3-5 años'] },
    interests: ['Gastronomía', 'Lectura', 'Parques y naturaleza'],
    location: CITIES.madrid,
  },
  {
    email: 'pablo.sanz@mock.lif', password: 'Mock1234!',
    username: 'pablo_adrian', displayName: 'Pablo y Adrián',
    photoURL: photo(24), photos: [photo(24), photo(34)], age: 30,
    bio: 'Músicos en Zaragoza y papás de un bebé de 14 meses. Siempre hay música en casa y queremos compartirla con más familias.',
    composition: { household: 'Dos padres', childrenAges: ['0-2 años'] },
    interests: ['Música', 'Arte y manualidades', 'Viajes'],
    location: CITIES.zaragoza,
  },
  {
    email: 'rocio.jimenez@mock.lif', password: 'Mock1234!',
    username: 'rocio_clara', displayName: 'Rocío y Clara',
    photoURL: photo(25), photos: [photo(25), photo(35)], age: 36,
    bio: 'En Sevilla, con nuestra hija de 8 años que ya habla inglés mejor que nosotras. Voluntarias en ONGs locales y siempre dispuestas a echar una mano.',
    composition: { household: 'Dos madres', childrenAges: ['6-9 años'] },
    interests: ['Voluntariado', 'Viajes', 'Lectura'],
    location: CITIES.sevilla,
  },
  {
    email: 'fernando.blanco@mock.lif', password: 'Mock1234!',
    username: 'fer_blanco', displayName: 'Fernando Blanco',
    photoURL: photo(26), photos: [photo(26)], age: 42,
    bio: 'Papá entrenador de baloncesto con un hijo de 11 años que ya le gana uno contra uno. Buscamos compañeros de deporte y aventuras los fines de semana.',
    composition: { household: 'Monoparental', childrenAges: ['10-12 años'] },
    interests: ['Deporte', 'Juegos de mesa', 'Cine y series'],
    location: CITIES.madrid,
  },
  {
    email: 'valentina.herrero@mock.lif', password: 'Mock1234!',
    username: 'valen_diana', displayName: 'Valentina y Diana',
    photoURL: photo(27), photos: [photo(27), photo(37)], age: 34,
    bio: 'Valencia, sol y dos niñas fantásticas de 5 y 7 años. Viajeras de corazón, intentamos hacer al menos un viaje al mes aunque sea pequeño.',
    composition: { household: 'Dos madres', childrenAges: ['3-5 años', '6-9 años'], pets: ['Ave'] },
    interests: ['Viajes', 'Parques y naturaleza', 'Gastronomía'],
    location: CITIES.valencia,
  },
  {
    email: 'tomas.aguilar@mock.lif', password: 'Mock1234!',
    username: 'tomas_emilio', displayName: 'Tomás y Emilio',
    photoURL: photo(28), photos: [photo(28), photo(38)], age: 29,
    bio: 'Papás novatos de un bebé de 9 meses en Madrid. Estamos aprendiendo sobre la marcha y queremos rodearnos de familias con experiencia que nos den un poco de luz.',
    composition: { household: 'Dos padres', childrenAges: ['0-2 años'] },
    interests: ['Parques y naturaleza', 'Gastronomía', 'Juegos de mesa'],
    location: CITIES.madrid,
  },
  {
    email: 'silvia.morales@mock.lif', password: 'Mock1234!',
    username: 'silvia_morales', displayName: 'Silvia Morales',
    photoURL: photo(29), photos: [photo(29)], age: 44,
    bio: 'Mamá de un adolescente de 16 años, escritora y lectora empedernida. Buscamos familias con chicos mayores para salidas culturales y conversaciones interesantes.',
    composition: { household: 'Monoparental', childrenAges: ['13+ años'] },
    interests: ['Lectura', 'Teatro', 'Cine y series'],
    location: CITIES.barcelona,
  },
  {
    email: 'rafael.cruz@mock.lif', password: 'Mock1234!',
    username: 'rafa_ignacio', displayName: 'Rafael e Ignacio',
    photoURL: photo(30), photos: [photo(30), photo(40)], age: 39,
    bio: 'Familia reconstituida en Madrid con mucho cariño y algún que otro caos. Entre los dos sumamos tres hijos que se quieren como hermanos. La mesa siempre está puesta para más.',
    composition: { household: 'Familia reconstituida', childrenAges: ['3-5 años', '10-12 años'], pets: ['Perro'] },
    interests: ['Gastronomía', 'Viajes', 'Deporte'],
    location: CITIES.madrid,
  },
];

// ── Servicios mock ────────────────────────────────────────────────────────────

const SERVICES = [
  {
    name: 'Guardería Arcoíris',
    description: 'Guardería inclusiva y acogedora para familias diversas en el centro de Madrid. Ambiente seguro y estimulante para bebés y niños de 0 a 3 años.',
    category: 'Educación',
    icon: '🏫',
    price: 650,
    rating: 4.8,
    schedule: 'Lunes a viernes, 7:30 a 20:00',
    city: 'Madrid',
    tags: ['guardería', 'educación', 'inclusivo', 'bebés', 'Madrid'],
    location: { city: 'Madrid', latitude: 40.4200, longitude: -3.7050 },
    featured: true, archived: false,
    contact_email: 'info@guarderiaarcoiris.es',
    contact_phone: '910 123 456',
  },
  {
    name: 'Campamento Verano Diverso',
    description: 'Campamento de verano en Barcelona para niños de 6 a 12 años de familias LGBTI+. Actividades de naturaleza, creatividad y convivencia.',
    category: 'Actividades',
    icon: '⛺',
    price: 800,
    rating: 4.9,
    schedule: 'Julio y agosto, semanas completas',
    city: 'Barcelona',
    tags: ['campamento', 'verano', 'naturaleza', 'Barcelona', 'LGBTI+'],
    location: { city: 'Barcelona', latitude: 41.3900, longitude: 2.1800 },
    featured: true, archived: false,
    contact_email: 'hola@campamentodiverso.es',
    contact_phone: '932 456 789',
  },
  {
    name: 'Taller Familias Creadoras',
    description: 'Talleres de arte y manualidades para familias en Valencia. Sesiones de 2 horas los sábados por la mañana. Todos los niveles bienvenidos.',
    category: 'Talleres',
    icon: '🎨',
    price: 25,
    rating: 4.7,
    schedule: 'Sábados, 10:00 a 12:00',
    city: 'Valencia',
    tags: ['arte', 'manualidades', 'talleres', 'Valencia', 'familias'],
    location: { city: 'Valencia', latitude: 39.4750, longitude: -0.3700 },
    featured: false, archived: false,
    contact_email: 'talleres@familiasc.es',
    contact_phone: '963 789 012',
  },
  {
    name: 'Escuela de Música Armonía',
    description: 'Clases de música para peques desde los 2 años. Piano, guitarra, percusión y lenguaje musical. Profesores especializados en metodología Dalcroze.',
    category: 'Música',
    icon: '🎵',
    price: 80,
    rating: 4.6,
    schedule: 'Lunes a sábado, horario a convenir',
    city: 'Madrid',
    tags: ['música', 'piano', 'guitarra', 'niños', 'Madrid'],
    location: { city: 'Madrid', latitude: 40.4100, longitude: -3.6950 },
    featured: false, archived: false,
    contact_email: 'matriculas@escuelaarmonia.es',
    contact_phone: '915 234 567',
  },
  {
    name: 'Centro de Ocio Familiar Pride',
    description: 'Espacio de ocio y actividades deportivas para familias diversas en Sevilla. Piscina, gimnasio y sala de juegos. Abonos familiares disponibles.',
    category: 'Deporte',
    icon: '🏊',
    price: 45,
    rating: 4.5,
    schedule: 'Lunes a domingo, 7:00 a 22:00',
    city: 'Sevilla',
    tags: ['deporte', 'piscina', 'ocio', 'Sevilla', 'familias'],
    location: { city: 'Sevilla', latitude: 37.3950, longitude: -5.9800 },
    featured: true, archived: false,
    contact_email: 'socios@ociofamiliarpride.es',
    contact_phone: '954 321 654',
  },
];

// ── Limpiar base de datos ─────────────────────────────────────────────────────

async function deleteAllAuthUsers() {
  let pageToken;
  let total = 0;
  do {
    const result = await auth.listUsers(1000, pageToken);
    if (result.users.length === 0) break;
    const uids = result.users.map(u => u.uid);
    await auth.deleteUsers(uids);
    total += uids.length;
    pageToken = result.pageToken;
  } while (pageToken);
  console.log(`  ✓ Eliminados ${total} usuarios de Auth`);
}

async function deleteAllCollections() {
  const collections = [
    'users', 'matches', 'conversations', 'reservations',
    'services', 'posts', 'teams', 'reports',
    'user_limits', 'email_verifications', 'notifications',
  ];
  for (const name of collections) {
    const ref = db.collection(name);
    await db.recursiveDelete(ref);
    console.log(`  ✓ Eliminada colección: ${name}`);
  }
}

// ── Crear usuarios mock ───────────────────────────────────────────────────────

async function createUser(family) {
  // Crear cuenta en Firebase Auth
  const userRecord = await auth.createUser({
    email: family.email,
    password: family.password,
    displayName: family.displayName,
    photoURL: family.photoURL,
  });

  const uid = userRecord.uid;
  const batch = db.batch();

  // Documento principal users/{uid}
  batch.set(db.collection('users').doc(uid), {
    id: uid,
    email: family.email,
    username: family.username,
    displayName: family.displayName,
    photoURL: family.photoURL,
    photos: family.photos,
    bio: family.bio,
    composition: family.composition,
    age: family.age,
    gender: null,
    interests: family.interests,
    location: family.location,
    subscription_type: 'free',
    subscription_end_date: null,
    fcm_tokens: [],
    created_at: now,
    updated_at: now,
  });

  // Perfil social
  batch.set(db.collection('users').doc(uid).collection('profiles').doc('main'), {
    premium_features: [], badges: [], followers_count: 0, following_count: 0, created_at: now,
  });

  // Límites de uso
  batch.set(db.collection('user_limits').doc(uid), {
    matches_today: 0, teams_created_month: 0, posts_today: 0,
    last_match_reset_date: now, last_team_reset_date: now, last_post_reset_date: now,
    subscription_tier: 'free',
  });

  await batch.commit();

  // Custom claims
  await auth.setCustomUserClaims(uid, { subscription_type: 'free' });

  return uid;
}

// ── Crear matches y conversaciones ────────────────────────────────────────────

async function createMutualMatch(uid1, uid2, conversationMessages) {
  const matchRef = db.collection('matches').doc();
  const convRef = db.collection('conversations').doc();

  await matchRef.set({
    id: matchRef.id,
    user1_id: uid1,
    user2_id: uid2,
    status: 'mutual_match',
    type: 'algorithm',
    compatibility_score: 70 + Math.floor(Math.random() * 25),
    conversation_id: convRef.id,
    created_at: now,
    updated_at: now,
    expires_at: null,
  });

  await convRef.set({
    id: convRef.id,
    participant1_id: uid1,
    participant2_id: uid2,
    last_message_text: conversationMessages[conversationMessages.length - 1].text,
    last_message_timestamp: FieldValue.serverTimestamp(),
    unread_count_p1: 0,
    unread_count_p2: 1,
    is_archived: false,
    hidden_for: [],
    muted_by: [],
    created_at: now,
    updated_at: now,
  });

  const msgBatch = db.batch();
  for (const msg of conversationMessages) {
    const msgRef = convRef.collection('messages').doc();
    msgBatch.set(msgRef, {
      id: msgRef.id,
      sender_id: msg.from === 1 ? uid1 : uid2,
      text: msg.text,
      timestamp: FieldValue.serverTimestamp(),
      is_read: true,
      attachments: [],
      is_edited: false,
      edited_at: null,
      is_deleted: false,
      reactions: {},
      encryption_key_index: 0,
    });
  }
  await msgBatch.commit();
}

async function createPendingMatch(uid1, uid2) {
  const matchRef = db.collection('matches').doc();
  await matchRef.set({
    id: matchRef.id,
    user1_id: uid1,
    user2_id: uid2,
    status: 'pending',
    type: 'algorithm',
    compatibility_score: 60 + Math.floor(Math.random() * 30),
    conversation_id: null,
    created_at: now,
    updated_at: now,
    expires_at: null,
  });
}

// ── Servicios ─────────────────────────────────────────────────────────────────

async function createServices() {
  const batch = db.batch();
  for (const service of SERVICES) {
    const ref = db.collection('services').doc();
    batch.set(ref, { id: ref.id, ...service, created_at: now, updated_at: now });
  }
  await batch.commit();
  console.log(`  ✓ ${SERVICES.length} servicios creados`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧹 Limpiando base de datos...');
  await deleteAllAuthUsers();
  await deleteAllCollections();

  console.log('\n👨‍👩‍👧 Creando 20 familias mock...');
  const uids = [];
  for (const family of FAMILIES) {
    const uid = await createUser(family);
    uids.push(uid);
    console.log(`  ✓ ${family.displayName} (${family.location.city})`);
  }

  console.log('\n💜 Creando matches y conversaciones...');

  // Matches mutuos con conversaciones
  await createMutualMatch(uids[0], uids[6], [
    { from: 1, text: '¡Hola! Vi tu perfil y creo que nuestras familias se llevarían genial 😊' },
    { from: 2, text: '¡Qué alegría! Tenemos peques de edades muy parecidas.' },
    { from: 1, text: '¿Os animáis a quedar este finde en el Retiro?' },
    { from: 2, text: 'Nos encantaría. ¿El sábado a las 11?' },
    { from: 1, text: 'Perfecto, apuntado 🎉' },
  ]);
  console.log('  ✓ Match: Sofía y Andrea ↔ Carmen y Patricia');

  await createMutualMatch(uids[1], uids[16], [
    { from: 1, text: 'Hola! Somos papás novatos de Barcelona buscando grupo 😄' },
    { from: 2, text: '¡Nosotras también tenemos una de 5 y otra de 7! Bienvenidos.' },
    { from: 1, text: '¿Hacéis planes por Gràcia?' },
    { from: 2, text: 'Sí! Solemos quedar en el parque de la Creueta del Coll los domingos.' },
  ]);
  console.log('  ✓ Match: Carlos y David ↔ Valentina y Diana');

  await createMutualMatch(uids[5], uids[15], [
    { from: 1, text: 'Hola Roberto! Papás solos molan mucho más de lo que parece, ¿verdad? 😄' },
    { from: 2, text: 'Totalmente. Y cuando los peques se juntan ellos solos se entretienen.' },
    { from: 1, text: 'Mi hijo juega al baloncesto también, igual los unimos.' },
    { from: 2, text: '¡Eso sería ideal! ¿Quedamos el finde que viene?' },
  ]);
  console.log('  ✓ Match: Roberto Díaz ↔ Fernando Blanco');

  await createMutualMatch(uids[3], uids[14], [
    { from: 1, text: 'Hola! Familias sevillanas tenemos que ayudarnos 🌞' },
    { from: 2, text: '¡Totalmente de acuerdo! ¿Tenéis planes para la Feria?' },
    { from: 1, text: 'Sí, llevamos a los peques el jueves por la tarde.' },
    { from: 2, text: 'Podemos ir juntos y que los niños se conozcan.' },
    { from: 1, text: 'Me parece perfecto 🎡' },
  ]);
  console.log('  ✓ Match: Miguel y Javier ↔ Rocío y Clara');

  await createMutualMatch(uids[9], uids[18], [
    { from: 1, text: 'Hola Silvia! Padres de adolescentes somos una especie rara por aquí 😄' },
    { from: 2, text: 'Jaja cierto! Mi hija ya no quiere saber nada de planes familiares.' },
    { from: 1, text: 'El nuestro igual. Pero igual quedan ellos solos y nosotros tomamos algo.' },
    { from: 2, text: 'Plan perfecto. ¿Cuándo quedamos?' },
  ]);
  console.log('  ✓ Match: Luis y Marcos ↔ Silvia Morales');

  // Solicitudes pendientes
  await createPendingMatch(uids[2],  uids[8]);  // Laura → Marta
  await createPendingMatch(uids[7],  uids[1]);  // Alejandro → Carlos
  await createPendingMatch(uids[11], uids[12]); // Familia Rodríguez → Beatriz
  await createPendingMatch(uids[13], uids[14]); // Pablo → Rocío
  await createPendingMatch(uids[17], uids[0]);  // Tomás → Sofía
  await createPendingMatch(uids[19], uids[3]);  // Rafael → Miguel
  console.log('  ✓ 6 solicitudes pendientes creadas');

  console.log('\n🏪 Creando servicios...');
  await createServices();

  console.log('\n✅ Seed completado.\n');
  console.log('Credenciales de acceso (email / contraseña):');
  FAMILIES.forEach(f => console.log(`  ${f.email}  /  ${f.password}`));
  console.log();
  process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
