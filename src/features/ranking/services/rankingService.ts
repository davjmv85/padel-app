import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RankingEntry } from '@/types';

const rankingsRef = collection(db, 'rankings');

export async function getRankings(maxResults = 100): Promise<RankingEntry[]> {
  const q = query(rankingsRef, orderBy('totalPoints', 'desc'), limit(maxResults));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RankingEntry));
}

/**
 * Recalculates rankings from scratch based on all matches and pairs.
 * Called from the client when a match is created or updated.
 */
export async function recalculateRankings(): Promise<void> {
  const [matchesSnap, pairsSnap] = await Promise.all([
    getDocs(collection(db, 'matches')),
    getDocs(collection(db, 'event_pairs')),
  ]);

  // Map of pairId -> pair data
  const pairsMap = new Map<string, { p1Id: string; p1Name: string; p2Id: string; p2Name: string }>();
  pairsSnap.docs.forEach((d) => {
    const data = d.data();
    pairsMap.set(d.id, {
      p1Id: data.player1Id,
      p1Name: data.player1Name,
      p2Id: data.player2Id,
      p2Name: data.player2Name,
    });
  });

  // Aggregate stats per player
  const playerStats: Record<string, { userName: string; won: number; played: number }> = {};

  for (const matchDoc of matchesSnap.docs) {
    const match = matchDoc.data();
    if (!match.winnerId) continue; // skip matches without result
    const winnerPair = pairsMap.get(match.winnerId);
    const loserPairId = match.pairAId === match.winnerId ? match.pairBId : match.pairAId;
    const loserPair = pairsMap.get(loserPairId);

    if (winnerPair) {
      for (const [pid, pname] of [[winnerPair.p1Id, winnerPair.p1Name], [winnerPair.p2Id, winnerPair.p2Name]]) {
        if (!playerStats[pid]) playerStats[pid] = { userName: pname, won: 0, played: 0 };
        playerStats[pid].userName = pname;
        playerStats[pid].won += 1;
        playerStats[pid].played += 1;
      }
    }

    if (loserPair) {
      for (const [pid, pname] of [[loserPair.p1Id, loserPair.p1Name], [loserPair.p2Id, loserPair.p2Name]]) {
        if (!playerStats[pid]) playerStats[pid] = { userName: pname, won: 0, played: 0 };
        playerStats[pid].userName = pname;
        playerStats[pid].played += 1;
      }
    }
  }

  // Write batch: delete stale rankings, set current ones
  const existingSnap = await getDocs(rankingsRef);
  const batch = writeBatch(db);

  existingSnap.docs.forEach((d) => {
    if (!playerStats[d.id]) batch.delete(d.ref);
  });

  for (const [userId, stats] of Object.entries(playerStats)) {
    batch.set(doc(rankingsRef, userId), {
      userId,
      userName: stats.userName,
      totalPoints: stats.won,
      matchesWon: stats.won,
      matchesPlayed: stats.played,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}
