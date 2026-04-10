import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventPair } from '@/types';

const pairsRef = collection(db, 'event_pairs');

export async function createPair(
  eventId: string,
  player1Id: string,
  player1Name: string,
  player2Id: string,
  player2Name: string,
  round?: number
): Promise<string> {
  // Validate no duplicates within the same scope
  // - americano (no round): a player can only be in one pair in the whole event
  // - libre (with round): a player can only be in one pair per fecha (same round)
  const existing = await getEventPairs(eventId);
  const relevant = round == null
    ? existing.filter(p => p.round == null)
    : existing.filter(p => p.round === round);
  const usedPlayerIds = new Set(relevant.flatMap((p) => [p.player1Id, p.player2Id]));
  if (usedPlayerIds.has(player1Id) || usedPlayerIds.has(player2Id)) {
    throw new Error('Uno o ambos jugadores ya están en otra pareja de esta fecha');
  }
  if (player1Id === player2Id) {
    throw new Error('Los jugadores deben ser diferentes');
  }

  const payload: Record<string, unknown> = {
    eventId,
    player1Id,
    player1Name,
    player2Id,
    player2Name,
    createdAt: serverTimestamp(),
  };
  if (round != null) payload.round = round;

  const docRef = await addDoc(pairsRef, payload);
  return docRef.id;
}

export async function getEventPairs(eventId: string): Promise<EventPair[]> {
  const q = query(pairsRef, where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventPair));
}

export async function updatePair(pairId: string, player1Id: string, player1Name: string, player2Id: string, player2Name: string): Promise<void> {
  await updateDoc(doc(db, 'event_pairs', pairId), {
    player1Id,
    player1Name,
    player2Id,
    player2Name,
  });
}

export async function deletePair(pairId: string): Promise<void> {
  await deleteDoc(doc(db, 'event_pairs', pairId));
}
