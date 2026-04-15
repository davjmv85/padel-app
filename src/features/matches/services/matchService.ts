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
  round?: number,
  extra?: {
    phase?: import('@/types').MatchPhase;
    groupNumber?: number;
    bracketRound?: number;
    bracketPosition?: number;
    courtId?: string;
    courtName?: string;
  }
): Promise<string> {
  if (pairAId === pairBId) throw new Error('Las parejas deben ser diferentes');

  const payload: Record<string, unknown> = {
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
  };
  if (extra?.phase) payload.phase = extra.phase;
  if (extra?.groupNumber != null) payload.groupNumber = extra.groupNumber;
  if (extra?.bracketRound != null) payload.bracketRound = extra.bracketRound;
  if (extra?.bracketPosition != null) payload.bracketPosition = extra.bracketPosition;
  if (extra?.courtId) payload.courtId = extra.courtId;
  if (extra?.courtName) payload.courtName = extra.courtName;

  const docRef = await addDoc(matchesRef, payload);
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

export async function clearMatchResult(matchId: string): Promise<void> {
  await updateDoc(doc(db, 'matches', matchId), {
    scoreA: '',
    scoreB: '',
    winnerId: '',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEventMatches(eventId: string): Promise<void> {
  const q = query(matchesRef, where('eventId', '==', eventId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'matches', d.id));
  }
}
