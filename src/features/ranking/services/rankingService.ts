import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RankingEntry } from '@/types';

const rankingsRef = collection(db, 'rankings');

export async function getRankings(maxResults = 100): Promise<RankingEntry[]> {
  const q = query(rankingsRef, orderBy('totalPoints', 'desc'), limit(maxResults));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RankingEntry));
}
