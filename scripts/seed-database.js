'use strict';

/**
 * Seeds the Firestore emulator with realistic LGBTI+ family test data.
 * Run against emulators only: FIRESTORE_EMULATOR_HOST must be set.
 *
 * Usage:
 *   npm run seed
 *
 * Or manually:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   NODE_PATH=functions/node_modules \
 *   node scripts/seed-database.js
 */

process.env.FIRESTORE_EMULATOR_HOST  = process.env.FIRESTORE_EMULATOR_HOST  || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

const admin = require('firebase-admin');
const { FieldValue } = require('@google-cloud/firestore');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'loveisfamily-dev' });
}

const db   = admin.firestore();
const auth = admin.auth();

// ── Helpers ───────────────────────────────────────────────────────────────────

const pick   = (arr)           => arr[Math.floor(Math.random() * arr.length)];
const subset = (arr, min, max) => [...arr].sort(() => Math.random() - 0.5).slice(0, min + Math.floor(Math.random() * (max - min + 1)));
const randInt = (a, b)         => a + Math.floor(Math.random() * (b - a + 1));
const ts      = (daysBack)     => admin.firestore.Timestamp.fromDate(new Date(Date.now() - daysBack * 86400000));

// ── Master data ───────────────────────────────────────────────────────────────

const PASSWORD = 'Test1234!';

const CITIES = {
  barcelona: { name: 'Barcelona', lat: 41.3851, lng: 2.1734 },
  madrid:    { name: 'Madrid',    lat: 40.4168, lng: -3.7038 },
  valencia:  { name: 'Valencia',  lat: 39.4699, lng: -0.3763 },
  sevilla:   { name: 'Sevilla',   lat: 37.3891, lng: -5.9845 },
};

const INTERESTS_ALL = ['yoga', 'arte', 'viajes', 'deporte', 'cocina', 'fotografía',
  'naturaleza', 'música', 'lectura', 'senderismo', 'gaming', 'bienestar', 'teatro', 'baile'];

const HOUSEHOLDS = ['Dos madres', 'Dos padres', 'Monoparental', 'Familia reconstituida'];

// ── 12 familias diversas ──────────────────────────────────────────────────────

const USERS_SEED = [
  {
    username: 'ana_sara_bcn',
    email: 'ana@test.com',
    displayName: 'Ana & Sara',
    bio: 'Dos mamás muy activas, amantes del yoga y el arte. Tenemos una hija de 4 años y un golden retriever. Buscamos familias amigas en Barcelona.',
    household: 'Dos madres',
    childrenAges: ['3-5 años'],
    pets: ['Perro'],
    city: 'barcelona',
    tier: 'premium',
    interests: ['yoga', 'arte', 'fotografía', 'viajes'],
    verificationStatus: 'approved',
  },
  {
    username: 'carlos_miguel_mad',
    email: 'carlos@test.com',
    displayName: 'Carlos & Miguel',
    bio: 'Papás madrileños con dos peques energéticos. Nos encanta el deporte y la buena cocina. Siempre listos para una quedada en el parque.',
    household: 'Dos padres',
    childrenAges: ['3-5 años', '6-9 años'],
    pets: [],
    city: 'madrid',
    tier: 'premium',
    interests: ['deporte', 'cocina', 'senderismo', 'música'],
    verificationStatus: 'approved',
  },
  {
    username: 'laura_val',
    email: 'laura@test.com',
    displayName: 'Laura Gómez',
    bio: 'Mamá soltera y fotógrafa. Mi hija Lucía y yo somos un equipo inseparable. Nos encanta la naturaleza y explorar nuevos rincones de Valencia.',
    household: 'Monoparental',
    childrenAges: ['6-9 años'],
    pets: ['Gato'],
    city: 'valencia',
    tier: 'vip',
    interests: ['fotografía', 'naturaleza', 'música', 'teatro'],
    verificationStatus: 'approved',
  },
  {
    username: 'sofia_marta_bcn',
    email: 'sofia@test.com',
    displayName: 'Sofía & Marta',
    bio: 'Familia de lectoras empedernidas. Dos mamás con gemelos de 7 años. Buscamos grupos de crianza respetuosa y actividades culturales.',
    household: 'Dos madres',
    childrenAges: ['6-9 años'],
    pets: [],
    city: 'barcelona',
    tier: 'free',
    interests: ['lectura', 'arte', 'teatro', 'bienestar'],
    verificationStatus: 'pending',
  },
  {
    username: 'pedro_javi_mad',
    email: 'pedro@test.com',
    displayName: 'Pedro & Javi',
    bio: 'Papás madrileños friquis y musicófilos. Nuestro hijo Mateo tiene 5 años y ya toca la batería. Buscamos otras familias con niños de su edad.',
    household: 'Dos padres',
    childrenAges: ['3-5 años'],
    pets: ['Perro'],
    city: 'madrid',
    tier: 'free',
    interests: ['gaming', 'música', 'deporte'],
    verificationStatus: 'not_submitted',
  },
  {
    username: 'carmen_sev',
    email: 'carmen@test.com',
    displayName: 'Carmen Ruiz',
    bio: 'Sevillana de pura cepa, mamá de dos adolescentes maravillosos. Cocinera aficionada y viajera empedernida. Activa en la comunidad LGBTI+ local.',
    household: 'Monoparental',
    childrenAges: ['10-12 años', '13+ años'],
    pets: [],
    city: 'sevilla',
    tier: 'premium',
    interests: ['cocina', 'viajes', 'arte', 'baile'],
    verificationStatus: 'approved',
  },
  {
    username: 'luis_elena_bcn',
    email: 'luis@test.com',
    displayName: 'Luis & Elena',
    bio: 'Familia reconstituida con mucho amor y algún caos. Cuatro hijos entre los dos, edades variadas. Nos encanta el deporte y las escapadas a la montaña.',
    household: 'Familia reconstituida',
    childrenAges: ['0-2 años', '6-9 años', '10-12 años'],
    pets: ['Perro', 'Gato'],
    city: 'barcelona',
    tier: 'free',
    interests: ['deporte', 'fotografía', 'senderismo', 'naturaleza'],
    verificationStatus: 'not_submitted',
  },
  {
    username: 'maria_lucia_mad',
    email: 'maria@test.com',
    displayName: 'María & Lucía',
    bio: 'Instructoras de yoga y amantes del bienestar. Tenemos un bebé de 18 meses y buscamos familias con bebés para compartir experiencias y aprendizajes.',
    household: 'Dos madres',
    childrenAges: ['0-2 años'],
    pets: [],
    city: 'madrid',
    tier: 'vip',
    interests: ['yoga', 'bienestar', 'naturaleza', 'viajes'],
    verificationStatus: 'approved',
  },
  {
    username: 'toni_rafa_val',
    email: 'toni@test.com',
    displayName: 'Toni & Rafa',
    bio: 'Papás viajeros y curiosos. Tenemos tres peques y una furgoneta camperizada. Buscamos familias para compartir aventuras y rutas por España.',
    household: 'Dos padres',
    childrenAges: ['3-5 años', '6-9 años', '10-12 años'],
    pets: [],
    city: 'valencia',
    tier: 'free',
    interests: ['viajes', 'arte', 'senderismo', 'fotografía'],
    verificationStatus: 'approved',
  },
  {
    username: 'nuria_bcn',
    email: 'nuria@test.com',
    displayName: 'Nuria Martínez',
    bio: 'Mamá soltera y músico de jazz. Mi hijo Pablo tiene 9 años y toca el piano. Buscamos actividades culturales y otras familias con niños aficionados a la música.',
    household: 'Monoparental',
    childrenAges: ['6-9 años'],
    pets: ['Gato'],
    city: 'barcelona',
    tier: 'premium',
    interests: ['música', 'fotografía', 'teatro', 'arte'],
    verificationStatus: 'approved',
  },
  {
    username: 'alex_diana_mad',
    email: 'alex@test.com',
    displayName: 'Alex & Diana',
    bio: 'Dos mamás senderistas y amantes de la naturaleza. Vivimos en las afueras de Madrid con nuestra hija adoptada Maya y nuestro perro Rocky. ¡Siempre de ruta!',
    household: 'Dos madres',
    childrenAges: ['6-9 años'],
    pets: ['Perro'],
    city: 'madrid',
    tier: 'free',
    interests: ['naturaleza', 'senderismo', 'deporte', 'fotografía'],
    verificationStatus: 'not_submitted',
  },
  {
    username: 'jose_alberto_sev',
    email: 'jose@test.com',
    displayName: 'José & Alberto',
    bio: 'Familia sevillana muy musical. Dos papás con dos hijos adolescentes. Activos en la asociación de familias diversas de Andalucía.',
    household: 'Dos padres',
    childrenAges: ['13+ años', '13+ años'],
    pets: [],
    city: 'sevilla',
    tier: 'free',
    interests: ['música', 'cocina', 'baile', 'arte'],
    verificationStatus: 'not_submitted',
  },
];

// ── Auth + Firestore users ────────────────────────────────────────────────────

async function createAuthUser(seed) {
  try {
    const user = await auth.createUser({ email: seed.email, password: PASSWORD, displayName: seed.displayName });
    await auth.setCustomUserClaims(user.uid, { subscription_type: seed.tier });
    console.log(`  ✓ ${seed.email} (${seed.tier})`);
    return user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(seed.email);
      await auth.setCustomUserClaims(user.uid, { subscription_type: seed.tier });
      console.log(`  ~ already exists: ${seed.email}`);
      return user.uid;
    }
    throw err;
  }
}

async function seedUsers() {
  console.log('\n── Usuarios ──────────────────────────────────────────────');
  const uids = [];

  for (const seed of USERS_SEED) {
    const uid = await createAuthUser(seed);
    const city = CITIES[seed.city];
    const jitter = () => (Math.random() - 0.5) * 0.12;

    await db.collection('users').doc(uid).set({
      id: uid,
      email: seed.email,
      username: seed.username,
      displayName: seed.displayName,
      photoURL: null,
      bio: seed.bio,
      interests: seed.interests,
      household: seed.household,
      children_ages: seed.childrenAges,
      pets: seed.pets,
      location: { latitude: city.lat + jitter(), longitude: city.lng + jitter(), city: city.name },
      subscription_type: seed.tier,
      email_verified: true,
      verification_status: seed.verificationStatus,
      created_at: ts(randInt(15, 90)),
      updated_at: ts(randInt(0, 7)),
    });

    await db.collection('user_limits').doc(uid).set({
      matches_today: 0,
      teams_created_month: 0,
      posts_today: 0,
      last_match_reset_date: ts(0),
      last_team_reset_date: ts(0),
      last_post_reset_date: ts(0),
      subscription_tier: seed.tier,
    });

    uids.push(uid);
  }

  return uids;
}

// ── Verification documents ────────────────────────────────────────────────────

async function seedVerifications(uids) {
  console.log('\n── Verificaciones ────────────────────────────────────────');
  const statuses = USERS_SEED.map(u => u.verificationStatus);

  for (let i = 0; i < uids.length; i++) {
    const status = statuses[i];
    if (status === 'not_submitted') continue;

    await db.collection('verifications').doc(uids[i]).set({
      user_id: uids[i],
      document_photo_url: 'https://placehold.co/600x400?text=ID+Document',
      status,
      submitted_at: ts(randInt(3, 20)),
      reviewed_at: status === 'approved' ? ts(randInt(1, 3)) : null,
      rejection_reason: null,
    });
    console.log(`  ✓ ${USERS_SEED[i].username} → ${status}`);
  }
}

// ── Matches ───────────────────────────────────────────────────────────────────

async function seedMatches(uids) {
  console.log('\n── Matches ───────────────────────────────────────────────');

  // [indexA, indexB, status, score]
  const PAIRS = [
    [0, 1, 'mutual_match',  0.91],  // ana & carlos
    [0, 7, 'mutual_match',  0.87],  // ana & maria
    [1, 4, 'mutual_match',  0.83],  // carlos & pedro
    [2, 8, 'mutual_match',  0.79],  // laura & toni
    [3, 9, 'mutual_match',  0.85],  // sofia & nuria
    [5, 11,'mutual_match',  0.76],  // carmen & jose
    [6, 10,'mutual_match',  0.82],  // luis & alex
    [0, 3, 'pending',       0.72],  // ana → sofia
    [1, 7, 'pending',       0.68],  // carlos → maria
    [4, 10,'pending',       0.74],  // pedro → alex
    [2, 5, 'pending',       0.61],  // laura → carmen
    [8, 11,'accepted',      0.70],  // toni ↔ jose
    [3, 6, 'rejected',      0.45],  // sofia ✗ luis
    [9, 10,'rejected',      0.38],  // nuria ✗ alex
  ];

  for (const [i, j, status, score] of PAIRS) {
    const ref = db.collection('matches').doc();
    await ref.set({
      id: ref.id,
      initiator_id: uids[i],
      target_id: uids[j],
      status,
      match_type: 'algorithm',
      compatibility_score: score,
      created_at: ts(randInt(1, 20)),
      updated_at: ts(randInt(0, 2)),
    });
    console.log(`  ✓ ${status.padEnd(14)} ${USERS_SEED[i].username} ↔ ${USERS_SEED[j].username}`);
  }
}

// ── Conversaciones ────────────────────────────────────────────────────────────

async function seedConversations(uids) {
  console.log('\n── Conversaciones ────────────────────────────────────────');

  const CONVS = [
    {
      a: 0, b: 1,  // ana & carlos
      messages: [
        { from: 0, text: '¡Hola! Vi que tenemos un match. Nuestros peques tienen edades parecidas 😊', daysBack: 8 },
        { from: 1, text: '¡Hola Ana! Sí, qué bien. ¿Vivís por Barcelona también?', daysBack: 8 },
        { from: 0, text: 'Sí, en el Eixample. ¿Vosotros?', daysBack: 7 },
        { from: 1, text: 'Nosotros en Madrid, pero venimos bastante. ¿Os apetece quedar cuando subamos?', daysBack: 7 },
        { from: 0, text: '¡Por supuesto! Tenemos sitios chulísimos para ir con niños aquí. Avisad 🎉', daysBack: 6 },
      ],
    },
    {
      a: 0, b: 7,  // ana & maria
      messages: [
        { from: 7, text: 'Hola! Vi que también hacéis yoga. ¿En qué centro vais?', daysBack: 3 },
        { from: 0, text: 'En YogaBCN, cerca de Gràcia. ¿Y vosotras?', daysBack: 3 },
        { from: 7, text: 'Nosotras damos clases en Casa Yoga Madrid. Si venís a Madrid os hacemos un descuento 😄', daysBack: 2 },
        { from: 0, text: '¡Qué bien! Vamos a Madrid en agosto. ¿Podemos quedar?', daysBack: 2 },
        { from: 7, text: 'Claro que sí 🙌 Además tenemos un bebé y a las niñas les vendría bien compañía', daysBack: 1 },
        { from: 0, text: 'Perfecto, mi hija tiene 4 años, le encantará. Os escribo cuando confirme fechas', daysBack: 1 },
      ],
    },
    {
      a: 2, b: 8,  // laura & toni
      messages: [
        { from: 8, text: 'Hola Laura! Somos de Valencia también. ¿Os gustan las rutas en furgoneta?', daysBack: 5 },
        { from: 2, text: '¡Me encanta la idea! Mi hija y yo adoramos la naturaleza. ¿Hacéis rutas cortas también?', daysBack: 5 },
        { from: 8, text: 'Sí, tenemos de todos los niveles. El mes que viene vamos a la Sierra de Gredos, ¿os apuntáis?', daysBack: 4 },
        { from: 2, text: 'Suena genial. ¿Cuántos días sería?', daysBack: 4 },
        { from: 8, text: 'Un fin de semana largo, jueves a domingo. Somos en total 5 personas con los peques', daysBack: 3 },
        { from: 2, text: '¡Me interesa mucho! Miramos fechas y te confirmo esta semana 🏕️', daysBack: 2 },
      ],
    },
    {
      a: 3, b: 9,  // sofia & nuria
      messages: [
        { from: 9, text: 'Hola Sofía, vi que os gusta la música. ¿Lleváis a los niños a conciertos?', daysBack: 12 },
        { from: 3, text: '¡Hola! Sí, aunque los gemelos prefieren el teatro por ahora. ¿Vuestro hijo toca algún instrumento?', daysBack: 11 },
        { from: 9, text: 'Piano 🎹 ¡Tiene 9 años y ya toca bastante bien! Damos clases en una escuela del Raval', daysBack: 11 },
        { from: 3, text: '¡Qué maravilla! A uno de los gemelos le gustaría aprender. ¿Cómo se llama la escuela?', daysBack: 10 },
        { from: 9, text: 'Escola de Música Arc de Sant Martí. Muy buena y muy integradora. Te paso el contacto', daysBack: 10 },
      ],
    },
  ];

  for (const conv of CONVS) {
    const last = conv.messages[conv.messages.length - 1];
    const convRef = db.collection('conversations').doc();
    const cid = convRef.id;

    await convRef.set({
      id: cid,
      participants: [uids[conv.a], uids[conv.b]],
      participant_map: { [uids[conv.a]]: true, [uids[conv.b]]: true },
      last_message: {
        text: last.text,
        sender_id: uids[last.from],
        sent_at: ts(last.daysBack),
      },
      last_message_at: ts(last.daysBack),
      unread_count: { [uids[conv.a]]: 0, [uids[conv.b]]: 1 },
      created_at: ts(conv.messages[0].daysBack + 1),
    });

    for (const msg of conv.messages) {
      const msgRef = convRef.collection('messages').doc();
      await msgRef.set({
        id: msgRef.id,
        conversation_id: cid,
        sender_id: uids[msg.from],
        text: msg.text,
        sent_at: ts(msg.daysBack),
        read_by: [uids[msg.from]],
        deleted: false,
      });
    }

    console.log(`  ✓ ${USERS_SEED[conv.a].username} ↔ ${USERS_SEED[conv.b].username} (${conv.messages.length} msgs)`);
  }
}

// ── Posts ─────────────────────────────────────────────────────────────────────

async function seedPosts(uids) {
  console.log('\n── Posts de comunidad ────────────────────────────────────');

  const POSTS = [
    {
      authorIdx: 0,
      title: 'Quedada familias con peques en el Parc de la Ciutadella 🌳',
      description: 'Organizamos una quedada este sábado a las 11h en la fuente del parque. Venid con picnic y ganas de pasar un rato genial. ¡Todos los peques bienvenidos!',
      activity_type: 'social',
      tags: ['barcelona', 'peques', 'parque', 'quedada'],
      location: { city: 'Barcelona' },
      likes_count: 24,
      daysBack: 2,
      comments: [
        { authorIdx: 3, text: '¡Nos apuntamos! Los gemelos están encantados 🎉', daysBack: 2 },
        { authorIdx: 9, text: 'Pablo y yo estaremos allí. ¿Llevamos merienda para compartir?', daysBack: 1 },
        { authorIdx: 6, text: 'Perfecta idea. Nosotros llevamos sandía y galletas 😄', daysBack: 1 },
      ],
    },
    {
      authorIdx: 1,
      title: 'Ruta senderismo familiar Guadarrama — nivel fácil',
      description: '¿Alguien se apunta este domingo a la ruta de La Pedriza? 12km, nivel fácil, apta para niños desde 5 años. Quedamos a las 9h en el parking.',
      activity_type: 'sports',
      tags: ['madrid', 'senderismo', 'naturaleza', 'familia'],
      location: { city: 'Madrid' },
      likes_count: 31,
      daysBack: 4,
      comments: [
        { authorIdx: 4, text: '¡Nosotros nos apuntamos! ¿Tenéis bastones de niño o llevamos los nuestros?', daysBack: 4 },
        { authorIdx: 7, text: 'Nosotras también vamos. Perfecto para estrenar las botas de Claudia 😍', daysBack: 3 },
        { authorIdx: 10, text: '¡Genial! Rocky (nuestro perro) viene también, espero que no haya problema', daysBack: 3 },
        { authorIdx: 1, text: 'Perros bienvenidos con correa por favor 🐕', daysBack: 2 },
      ],
    },
    {
      authorIdx: 7,
      title: 'Clase de yoga mamá-bebé todos los miércoles ☀️',
      description: 'Retomamos las clases de yoga para mamás con bebés de 0 a 18 meses. Miércoles 10:30h en Casa Yoga (Malasaña). Plazas limitadas, escribidme por chat.',
      activity_type: 'sports',
      tags: ['madrid', 'yoga', 'bebé', 'bienestar'],
      location: { city: 'Madrid' },
      likes_count: 18,
      daysBack: 6,
      comments: [
        { authorIdx: 1, text: '¡Qué buena iniciativa! Conocemos a dos familias con bebés que buscan algo así', daysBack: 6 },
        { authorIdx: 0, text: 'Ojalá hubiese algo así en Barcelona 🙏', daysBack: 5 },
      ],
    },
    {
      authorIdx: 2,
      title: 'Recomendación: guardería Arcoíris Valencia ⭐⭐⭐⭐⭐',
      description: 'Llevamos a Lucía tres años y no podemos estar más contentas. Personal formado en diversidad familiar, ambiente increíble. Si buscáis guardería en Valencia, esta es la vuestra.',
      activity_type: 'social',
      tags: ['valencia', 'guardería', 'recomendación', 'educación'],
      location: { city: 'Valencia' },
      likes_count: 47,
      daysBack: 8,
      comments: [
        { authorIdx: 8, text: 'Confirmado, nuestros hijos también van ahí. Excelente trato y muy implicados con la comunidad', daysBack: 8 },
        { authorIdx: 3, text: 'Gracias por la recomendación, justo estamos buscando en Valencia para las vacaciones', daysBack: 7 },
        { authorIdx: 5, text: '¿Tienen lista de espera? Preguntamos para el año que viene', daysBack: 7 },
        { authorIdx: 2, text: 'Sí, llamad con tiempo. Pero merece la pena esperar', daysBack: 6 },
      ],
    },
    {
      authorIdx: 5,
      title: 'Festival de familias diversas Sevilla — ¡este finde!',
      description: 'El sábado y domingo hay festival en el Parque de María Luisa. Talleres, música, food trucks y zona de juegos. Entrada gratuita. ¡Os esperamos a todos!',
      activity_type: 'social',
      tags: ['sevilla', 'festival', 'gratuito', 'familia'],
      location: { city: 'Sevilla' },
      likes_count: 62,
      daysBack: 3,
      comments: [
        { authorIdx: 11, text: '¡Qué ganas! Nosotros actuamos el domingo con la banda. A las 18h en el escenario principal', daysBack: 3 },
        { authorIdx: 5, text: '¡No me lo pierdo! Qué orgullo teneros en el festival 🎶', daysBack: 2 },
      ],
    },
    {
      authorIdx: 9,
      title: 'Concierto infantil jazz — Escola de Música Arc de Sant Martí',
      description: 'El próximo viernes a las 18h, concierto fin de curso de nuestro alumnado. Pablo toca en el quinteto de piano. ¡Entrada libre, venid todos!',
      activity_type: 'social',
      tags: ['barcelona', 'música', 'jazz', 'concierto'],
      location: { city: 'Barcelona' },
      likes_count: 33,
      daysBack: 5,
      comments: [
        { authorIdx: 0, text: '¡Allí estaremos! Mi hija lleva semanas esperando ver tocar a Pablo 🎹', daysBack: 5 },
        { authorIdx: 3, text: 'Los gemelos preguntan si habrá merienda después jajaja', daysBack: 4 },
        { authorIdx: 9, text: 'Por supuesto 🍰 lo tiene organizado la AMPA', daysBack: 4 },
      ],
    },
    {
      authorIdx: 10,
      title: 'Buscamos compañeros de ruta — Sierra de Madrid',
      description: 'Alex y yo queremos retomar las salidas mensuales de senderismo. La próxima sería el tercer domingo de mes, sierra de Madrid, ruta media. ¿Quién se apunta?',
      activity_type: 'sports',
      tags: ['madrid', 'senderismo', 'mensual', 'naturaleza'],
      location: { city: 'Madrid' },
      likes_count: 15,
      daysBack: 10,
      comments: [
        { authorIdx: 1, text: '¡Nos apuntamos! Somos cuatro + perro 😄', daysBack: 10 },
        { authorIdx: 7, text: 'Nosotras también, aunque con el bebé iremos al ritmo que podamos', daysBack: 9 },
        { authorIdx: 10, text: 'Perfecto, lo hacemos al ritmo de todos. La montaña no tiene prisa ⛰️', daysBack: 9 },
      ],
    },
    {
      authorIdx: 4,
      title: 'Noche de juegos de mesa — casa de Pedro y Javi',
      description: 'Organizamos noche de juegos el próximo viernes. Los peques se quedan a dormir, y los adultos jugamos hasta medianoche. Catan, Pandemic, Codenames… ¿Traéis algo?',
      activity_type: 'social',
      tags: ['madrid', 'juegos', 'adultos', 'viernes'],
      location: { city: 'Madrid' },
      likes_count: 19,
      daysBack: 7,
      comments: [
        { authorIdx: 1, text: 'Llevamos Ticket to Ride y Dixit 🎲', daysBack: 7 },
        { authorIdx: 7, text: '¡Apuntadas! Llevamos Mysterium', daysBack: 6 },
        { authorIdx: 4, text: 'Perfecto, vamos a tener para toda la noche jajaja', daysBack: 6 },
      ],
    },
    {
      authorIdx: 3,
      title: '📚 Club de lectura para familias LGBTI+',
      description: 'Buscamos familias para montar un club de lectura mensual en Barcelona. Leemos libros sobre diversidad familiar, crianza y literatura LGBTI+. Primer encuentro en octubre.',
      activity_type: 'social',
      tags: ['barcelona', 'lectura', 'cultura', 'mensual'],
      location: { city: 'Barcelona' },
      likes_count: 28,
      daysBack: 14,
      comments: [
        { authorIdx: 0, text: '¡Qué iniciativa tan bonita! Nos apuntamos sin dudarlo', daysBack: 14 },
        { authorIdx: 9, text: 'Genial. ¿Tenéis algún libro en mente para empezar?', daysBack: 13 },
        { authorIdx: 3, text: 'Estamos pensando en "Dos mamás" de Beatriz Berrocal para el primero 📖', daysBack: 13 },
        { authorIdx: 6, text: 'Nosotros también queremos apuntarnos. ¿Hay límite de familias?', daysBack: 12 },
      ],
    },
    {
      authorIdx: 8,
      title: 'Ruta en furgo por Andalucía — buscamos co-viajeros',
      description: 'En octubre vamos de Valencia a Cádiz en furgoneta durante 10 días. Buscamos otra familia con niños para compartir aventura. Tenemos sitio para 4 personas más.',
      activity_type: 'sports',
      tags: ['viaje', 'furgo', 'andalucía', 'aventura'],
      location: { city: 'Valencia' },
      likes_count: 41,
      daysBack: 9,
      comments: [
        { authorIdx: 2, text: '¡Madre mía qué plan! ¿Cuántos días exactamente?', daysBack: 9 },
        { authorIdx: 5, text: 'Si pasáis por Sevilla tenéis casa y guía local garantizada 😊', daysBack: 8 },
        { authorIdx: 11, text: 'Misma oferta en Sevilla! Conocemos los mejores sitios', daysBack: 8 },
        { authorIdx: 8, text: 'Fantástico, entonces tenemos parada en Sevilla confirmada 🎉', daysBack: 7 },
      ],
    },
  ];

  const postIds = [];
  for (const p of POSTS) {
    const ref = db.collection('posts').doc();
    await ref.set({
      id: ref.id,
      author_id: uids[p.authorIdx],
      title: p.title,
      description: p.description,
      images: [],
      activity_type: p.activity_type,
      tags: p.tags,
      likes_count: p.likes_count,
      comments_count: p.comments.length,
      location: p.location,
      visibility: 'public',
      is_archived: false,
      created_at: ts(p.daysBack),
      updated_at: ts(p.daysBack),
    });

    for (const c of p.comments) {
      const cRef = ref.collection('comments').doc();
      await cRef.set({
        id: cRef.id,
        author_id: uids[c.authorIdx],
        text: c.text,
        timestamp: ts(c.daysBack),
        likes_count: randInt(0, 5),
      });
    }

    console.log(`  ✓ "${p.title.slice(0, 50)}…" (${p.comments.length} comentarios)`);
    postIds.push(ref.id);
  }

  return postIds;
}

// ── Grupos ────────────────────────────────────────────────────────────────────

async function seedTeams(uids) {
  console.log('\n── Grupos ────────────────────────────────────────────────');

  const TEAMS = [
    {
      name: 'Familias diversas Barcelona',
      description: 'El grupo más grande de familias LGBTI+ en Barcelona. Organizamos quedadas, actividades y damos apoyo mutuo.',
      ownerIdx: 0,
      memberIdxs: [0, 3, 6, 9],
      privacy_type: 'public',
      daysBack: 60,
    },
    {
      name: 'Madres lesbianas Madrid',
      description: 'Espacio de apoyo, recursos y amistad para madres lesbianas y bisexuales de Madrid y alrededores.',
      ownerIdx: 7,
      memberIdxs: [7, 0, 3],
      privacy_type: 'public',
      daysBack: 45,
    },
    {
      name: 'Papás gays España',
      description: 'Comunidad nacional de padres gays, bisexuales y trans. Intercambiamos experiencias, recursos y organizamos encuentros.',
      ownerIdx: 1,
      memberIdxs: [1, 4, 8, 11],
      privacy_type: 'public',
      daysBack: 90,
    },
    {
      name: 'Crianza respetuosa LGBTI+',
      description: 'Debate y recursos sobre crianza consciente y respetuosa en familias diversas. Recomendaciones de libros, talleres y profesionales.',
      ownerIdx: 3,
      memberIdxs: [3, 0, 2, 7, 9],
      privacy_type: 'public',
      daysBack: 30,
    },
    {
      name: 'Familias viajeras',
      description: 'Para familias LGBTI+ a las que les encanta viajar. Compartimos rutas, destinos seguros y organizamos viajes grupales.',
      ownerIdx: 8,
      memberIdxs: [8, 2, 5, 10],
      privacy_type: 'public',
      daysBack: 20,
    },
    {
      name: 'Red de apoyo Sevilla',
      description: 'Grupo privado de apoyo mutuo para familias diversas en Sevilla y Andalucía.',
      ownerIdx: 5,
      memberIdxs: [5, 11],
      privacy_type: 'private',
      daysBack: 25,
    },
  ];

  for (const team of TEAMS) {
    const ref = db.collection('teams').doc();
    const members = {};
    team.memberIdxs.forEach((idx, i) => {
      members[uids[idx]] = {
        role: i === 0 ? 'owner' : 'member',
        joined_at: ts(team.daysBack - i * 2).toDate().toISOString(),
      };
    });

    await ref.set({
      id: ref.id,
      name: team.name,
      description: team.description,
      owner_id: uids[team.ownerIdx],
      members,
      member_count: team.memberIdxs.length,
      activity_ids: [],
      privacy_type: team.privacy_type,
      created_at: ts(team.daysBack),
      updated_at: ts(randInt(0, 5)),
    });

    console.log(`  ✓ "${team.name}" (${team.memberIdxs.length} miembros, ${team.privacy_type})`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de LoveIsFamily...');
  console.log(`   Firestore : ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`   Auth      : ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

  try {
    const uids = await seedUsers();
    await seedVerifications(uids);
    await seedMatches(uids);
    await seedConversations(uids);
    await seedPosts(uids);
    await seedTeams(uids);

    console.log('\n✅  Seed completo!\n');
    console.log('Credenciales de prueba (contraseña: Test1234!)\n');
    const header = '  Email                     Familia                   Ciudad       Plan';
    console.log(header);
    console.log('  ' + '─'.repeat(header.length - 2));
    for (const u of USERS_SEED) {
      console.log(
        `  ${u.email.padEnd(25)} ${u.displayName.padEnd(25)} ${CITIES[u.city].name.padEnd(12)} ${u.tier}`
      );
    }
    console.log('');
  } catch (err) {
    console.error('\n❌ Seed fallido:', err.message, err.stack);
    process.exit(1);
  }

  process.exit(0);
}

main();
