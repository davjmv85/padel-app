import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration, AppUser } from '@/types';

const registrationsRef = collection(db, 'registrations');

export async function registerForEvent(eventId: string, user: AppUser): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await transaction.get(eventRef);

    if (!eventSnap.exists()) throw new Error('Evento no encontrado');

    const eventData = eventSnap.data();
    if (eventData.status !== 'published') throw new Error('El evento no está abierto para inscripciones');
    if (eventData.currentRegistrations >= eventData.maxCapacity) throw new Error('El evento está lleno');

    // Check duplicate
    const existingQuery = query(registrationsRef, where('eventId', '==', eventId), where('userId', '==', user.id), where('status', '==', 'active'));
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty) throw new Error('Ya estás inscripto en este evento');

    const regRef = doc(registrationsRef);
    transaction.set(regRef, {
      eventId,
      userId: user.id,
      userName: user.displayName,
      userPosition: user.position,
      paymentStatus: 'pending',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(eventRef, {
      currentRegistrations: eventData.currentRegistrations + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function cancelRegistration(registrationId: string, eventId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const regRef = doc(db, 'registrations', registrationId);
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await transaction.get(eventRef);

    if (!eventSnap.exists()) throw new Error('Evento no encontrado');

    transaction.update(regRef, {
      status: 'cancelled',
      paymentStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });

    transaction.update(eventRef, {
      currentRegistrations: Math.max(0, eventSnap.data().currentRegistrations - 1),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function getEventRegistrations(eventId: string): Promise<Registration[]> {
  const q = query(registrationsRef, where('eventId', '==', eventId), where('status', '==', 'active'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration));
}

export async function getUserRegistrations(userId: string): Promise<Registration[]> {
  const q = query(registrationsRef, where('userId', '==', userId), where('status', '==', 'active'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration));
}

export async function updatePaymentStatus(registrationId: string, status: 'pending' | 'paid' | 'cancelled', markedBy: string): Promise<void> {
  await updateDoc(doc(db, 'registrations', registrationId), {
    paymentStatus: status,
    paidMarkedBy: status === 'paid' ? markedBy : null,
    paidAt: status === 'paid' ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function addToWaitlist(eventId: string, userId: string, userEmail: string): Promise<void> {
  const waitlistRef = collection(db, 'waitlist');
  const existing = query(waitlistRef, where('eventId', '==', eventId), where('userId', '==', userId));
  const snap = await getDocs(existing);
  if (!snap.empty) throw new Error('Ya estás en la lista de espera');

  await addDoc(waitlistRef, {
    eventId,
    userId,
    userEmail,
    notified: false,
    createdAt: serverTimestamp(),
  });
}
