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
import { sendTelegramMessage, formatMsg } from '@/lib/telegram';
import { formatPrice } from '@/utils/format';
import type { PadelEvent, EventFormData } from '@/types';

const eventsRef = collection(db, 'events');

function buildPublishedMsg(ev: { name: string; location: string; date: string; time: string; maxCapacity: number; price: number; description?: string }): string {
  const dateStr = new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
  const lines = [
    `🏆 ${ev.name}`,
    `📅 ${dateStr} · ${ev.time}`,
    `📍 ${ev.location}`,
    `👥 Cupo: ${ev.maxCapacity}`,
    `💵 $${formatPrice(ev.price)}`,
  ];
  if (ev.description?.trim()) lines.push(`\n${ev.description.trim()}`);
  return formatMsg({ emoji: '🆕', title: 'Nuevo evento publicado', body: lines.join('\n') });
}

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

  if (data.status === 'published') {
    sendTelegramMessage(buildPublishedMsg(data), 'group');
  }

  return docRef.id;
}

export async function updateEvent(eventId: string, data: Partial<EventFormData>): Promise<void> {
  const eventRef = doc(db, 'events', eventId);
  const prevSnap = await getDoc(eventRef);
  const prevStatus = prevSnap.exists() ? (prevSnap.data().status as string | undefined) : undefined;

  const updateData: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.date) {
    updateData.date = new Date(data.date + 'T12:00:00');
  }
  await updateDoc(eventRef, updateData);

  const justPublished = data.status === 'published' && prevStatus !== 'published';
  if (justPublished && prevSnap.exists()) {
    const prev = prevSnap.data() as PadelEvent;
    const prevDateStr =
      prev.date && typeof (prev.date as unknown as { toDate?: () => Date }).toDate === 'function'
        ? (prev.date as unknown as { toDate: () => Date }).toDate().toISOString().slice(0, 10)
        : '';
    sendTelegramMessage(
      buildPublishedMsg({
        name: data.name ?? prev.name,
        location: data.location ?? prev.location,
        date: data.date ?? prevDateStr,
        time: data.time ?? prev.time,
        maxCapacity: data.maxCapacity ?? prev.maxCapacity,
        price: data.price ?? prev.price,
        description: data.description ?? prev.description,
      }),
      'group'
    );
  }
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

export async function deleteEventCascade(eventId: string): Promise<void> {
  const { deleteEventMatches } = await import('@/features/matches/services/matchService');
  const { deleteEventPairs } = await import('@/features/pairs/services/pairService');
  const { deleteEventGroups } = await import('./groupService');
  const { deleteEventRegistrations, deleteEventWaitlist } = await import('@/features/registrations/services/registrationService');
  const { recalculateRankings } = await import('@/features/ranking/services/rankingService');
  await deleteEventMatches(eventId);
  await deleteEventGroups(eventId);
  await deleteEventPairs(eventId);
  await deleteEventRegistrations(eventId);
  await deleteEventWaitlist(eventId);
  await deleteDoc(doc(db, 'events', eventId));
  await recalculateRankings();
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
