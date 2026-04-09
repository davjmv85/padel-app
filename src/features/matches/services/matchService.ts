import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Match } from '@/types';

const matchesRef = collection(db, 'matches');

export async function createMatch(
  eventId: string,
  pairAId: string,
  pairBId: string,
  scoreA: string,
  scoreB: string,
  winnerId: string,
  createdBy: string
): Promise<string> {
  if (pairAId === pairBId) throw new Error('Las parejas deben ser diferentes');
  if (winnerId !== pairAId && winnerId !== pairBId) throw new Error('El ganador debe ser una de las parejas');

  const docRef = await addDoc(matchesRef, {
    eventId,
    pairAId,
    pairBId,
    scoreA,
    scoreB,
    winnerId,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getEventMatches(eventId: string): Promise<Match[]> {
  const q = query(matchesRef, where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
}

export async function updateMatch(
  matchId: string,
  scoreA: string,
  scoreB: string,
  winnerId: string
): Promise<void> {
  await updateDoc(doc(db, 'matches', matchId), {
    scoreA,
    scoreB,
    winnerId,
    updatedAt: serverTimestamp(),
  });
}
