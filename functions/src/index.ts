import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Recalculate rankings when a match is created or updated.
 * Triggered on any write to the matches collection.
 */
export const onMatchWrite = functions.firestore
  .document('matches/{matchId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    // Determine which event(s) need recalculation
    const eventIds = new Set<string>();
    if (after?.eventId) eventIds.add(after.eventId);
    if (before?.eventId) eventIds.add(before.eventId);

    for (const eventId of eventIds) {
      await recalculateRankingsForEvent(eventId);
    }
  });

async function recalculateRankingsForEvent(eventId: string) {
  // Get all matches for this event
  const matchesSnap = await db.collection('matches').where('eventId', '==', eventId).get();

  // Build a map of player stats from ALL matches across all events
  // For a full recalc, we need all matches
  const allMatchesSnap = await db.collection('matches').get();

  const playerStats: Record<string, { userName: string; won: number; played: number }> = {};

  for (const doc of allMatchesSnap.docs) {
    const match = doc.data();
    const winnerPairId = match.winnerId;
    const loserPairId = match.pairAId === winnerPairId ? match.pairBId : match.pairAId;

    // Get pair data
    const [winnerPair, loserPair] = await Promise.all([
      db.collection('event_pairs').doc(winnerPairId).get(),
      db.collection('event_pairs').doc(loserPairId).get(),
    ]);

    if (winnerPair.exists) {
      const wp = winnerPair.data()!;
      for (const pid of [wp.player1Id, wp.player2Id]) {
        if (!playerStats[pid]) playerStats[pid] = { userName: wp[`player1Id` === pid ? 'player1Name' : 'player2Name'] || '', won: 0, played: 0 };
        playerStats[pid].won += 1;
        playerStats[pid].played += 1;
        // Fix name
        if (pid === wp.player1Id) playerStats[pid].userName = wp.player1Name;
        else playerStats[pid].userName = wp.player2Name;
      }
    }

    if (loserPair.exists) {
      const lp = loserPair.data()!;
      for (const pid of [lp.player1Id, lp.player2Id]) {
        if (!playerStats[pid]) playerStats[pid] = { userName: '', won: 0, played: 0 };
        playerStats[pid].played += 1;
        if (pid === lp.player1Id) playerStats[pid].userName = lp.player1Name;
        else playerStats[pid].userName = lp.player2Name;
      }
    }
  }

  // Write rankings
  const batch = db.batch();
  for (const [userId, stats] of Object.entries(playerStats)) {
    const rankRef = db.collection('rankings').doc(userId);
    batch.set(rankRef, {
      userId,
      userName: stats.userName,
      totalPoints: stats.won, // 1 point per win
      matchesWon: stats.won,
      matchesPlayed: stats.played,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * When a registration is cancelled (spot freed up),
 * check the waitlist and mark entries for notification.
 */
export const onRegistrationUpdate = functions.firestore
  .document('registrations/{registrationId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // If registration was just cancelled
    if (before.status === 'active' && after.status === 'cancelled') {
      const eventId = after.eventId;

      // Find waitlisted users who haven't been notified
      const waitlistSnap = await db
        .collection('waitlist')
        .where('eventId', '==', eventId)
        .where('notified', '==', false)
        .limit(5)
        .get();

      if (waitlistSnap.empty) return;

      const batch = db.batch();
      for (const doc of waitlistSnap.docs) {
        batch.update(doc.ref, { notified: true });
        // In production, send email here using a service like SendGrid
        // For MVP, we just mark as notified
        console.log(`[Waitlist] Would notify ${doc.data().userEmail} about spot in event ${eventId}`);
      }
      await batch.commit();
    }
  });

/**
 * Admin-only function to set a user's role.
 * This could be called from the frontend via httpsCallable for extra security.
 */
export const setUserRole = functions.https.onCall(async (data, context) => {
  // Verify caller is admin
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can change roles');
  }

  const { userId, role } = data;
  if (!userId || !['collaborator', 'player'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid userId or role');
  }

  await db.collection('users').doc(userId).update({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
