const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp({ projectId: 'padel-app-x4-685d9' });
const db = getFirestore();
const auth = getAuth();

const players = [
  { firstName: 'Martín', lastName: 'González', position: 'drive', email: 'martin.gonzalez@test.com' },
  { firstName: 'Lucas', lastName: 'Rodríguez', position: 'reves', email: 'lucas.rodriguez@test.com' },
  { firstName: 'Federico', lastName: 'López', position: 'drive', email: 'fede.lopez@test.com' },
  { firstName: 'Santiago', lastName: 'Martínez', position: 'indistinto', email: 'santi.martinez@test.com' },
  { firstName: 'Nicolás', lastName: 'García', position: 'reves', email: 'nico.garcia@test.com' },
  { firstName: 'Tomás', lastName: 'Fernández', position: 'drive', email: 'tomas.fernandez@test.com' },
  { firstName: 'Matías', lastName: 'Pérez', position: 'indistinto', email: 'matias.perez@test.com' },
  { firstName: 'Agustín', lastName: 'Sánchez', position: 'reves', email: 'agustin.sanchez@test.com' },
  { firstName: 'Joaquín', lastName: 'Díaz', position: 'drive', email: 'joaquin.diaz@test.com' },
  { firstName: 'Sebastián', lastName: 'Torres', position: 'indistinto', email: 'seba.torres@test.com' },
  { firstName: 'Diego', lastName: 'Ramírez', position: 'reves', email: 'diego.ramirez@test.com' },
  { firstName: 'Pablo', lastName: 'Álvarez', position: 'drive', email: 'pablo.alvarez@test.com' },
];

async function seed() {
  const batch = db.batch();
  const now = new Date();

  for (const player of players) {
    // Create auth user
    let uid;
    try {
      const userRecord = await auth.createUser({
        email: player.email,
        password: 'padel123',
        displayName: `${player.firstName} ${player.lastName}`,
      });
      uid = userRecord.uid;
      console.log(`Auth created: ${player.email} (${uid})`);
    } catch (e) {
      // User might already exist
      try {
        const existing = await auth.getUserByEmail(player.email);
        uid = existing.uid;
        console.log(`Auth exists: ${player.email} (${uid})`);
      } catch {
        console.error(`Failed for ${player.email}:`, e.message);
        continue;
      }
    }

    // Create Firestore user doc
    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, {
      email: player.email,
      displayName: `${player.firstName} ${player.lastName}`,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      role: 'player',
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log('\nDone! 12 players created.');
  console.log('Password for all: padel123');
}

seed().catch(console.error);
