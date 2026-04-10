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
import type { Match } from '@/types';

const matchesRef = collection(db, 'matches');

export async function createMatch(
  eventId: string,
  pairAId: string,
  pairBId: string,
  createdBy: string,
  round?: number
): Promise<string> {
  if (pairAId === pairBId) throw new Error('Las parejas deben ser diferentes');

  const docRef = await addDoc(matchesRef, {
    eventId,
    pairAId,
    pairBId,
    scoreA: '',
    scoreB: '',
    winnerId: '',
    round: round ?? null,
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

export async function deleteMatch(matchId: string): Promise<void> {
  await deleteDoc(doc(db, 'matches', matchId));
}
