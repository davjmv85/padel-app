import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventGroup } from '@/types';

const groupsRef = collection(db, 'event_groups');

export async function createGroup(
  eventId: string,
  groupNumber: number,
  pairIds: string[]
): Promise<string> {
  const docRef = await addDoc(groupsRef, {
    eventId,
    groupNumber,
    pairIds,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getEventGroups(eventId: string): Promise<EventGroup[]> {
  const q = query(groupsRef, where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as EventGroup))
    .sort((a, b) => a.groupNumber - b.groupNumber);
}

export async function deleteEventGroups(eventId: string): Promise<void> {
  const groups = await getEventGroups(eventId);
  for (const g of groups) {
    await deleteDoc(doc(db, 'event_groups', g.id));
  }
}
