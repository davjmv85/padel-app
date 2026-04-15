import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PadelEvent, EventFormData } from '@/types';

const eventsRef = collection(db, 'events');

export async function createEvent(data: EventFormData, userId: string, userEmail: string, userName: string): Promise<string> {
  const docRef = await addDoc(eventsRef, {
    ...data,
    tournamentType: data.tournamentType || 'liga',
    date: new Date(data.date + 'T12:00:00') as unknown as Timestamp,
    currentRegistrations: 0,
    createdBy: userId,
    createdByEmail: userEmail,
    createdByName: userName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateEvent(eventId: string, data: Partial<EventFormData>): Promise<void> {
  const updateData: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.date) {
    updateData.date = new Date(data.date + 'T12:00:00');
  }
  await updateDoc(doc(db, 'events', eventId), updateData);
}

export async function updateAmericanoConfig(eventId: string, config: import('@/types').AmericanoConfig): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    americanoConfig: config,
    updatedAt: serverTimestamp(),
  });
}

export async function updateAmericanoPhase(eventId: string, phase: import('@/types').AmericanoPhase): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    americanoPhase: phase,
    updatedAt: serverTimestamp(),
  });
}

export async function updateReyConfig(eventId: string, config: import('@/types').ReyConfig): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    reyConfig: config,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId));
}

export async function getEvent(eventId: string): Promise<PadelEvent | null> {
  const snap = await getDoc(doc(db, 'events', eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PadelEvent;
}

export async function getEvents(staffView: boolean): Promise<PadelEvent[]> {
  try {
    const q = staffView
      ? query(eventsRef, orderBy('date', 'desc'))
      : query(eventsRef, where('status', '==', 'published'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PadelEvent));
  } catch {
    // Fallback if composite index is not ready yet
    const q = staffView
      ? query(eventsRef)
      : query(eventsRef, where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PadelEvent));
  }
}
