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
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendTelegramMessage, formatMsg } from '@/lib/telegram';
import type { Registration, AppUser } from '@/types';

const registrationsRef = collection(db, 'registrations');

export async function registerForEvent(eventId: string, user: AppUser): Promise<void> {
  // Check duplicate before transaction (queries can't run inside transactions)
  const existingQuery = query(registrationsRef, where('eventId', '==', eventId), where('userId', '==', user.id), where('status', '==', 'active'));
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) throw new Error('Ya estás inscripto en este evento');

  let eventName = '';
  let newCount = 0;
  let maxCapacity = 0;

  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await transaction.get(eventRef);

    if (!eventSnap.exists()) throw new Error('Evento no encontrado');

    const eventData = eventSnap.data();
    if (eventData.status !== 'published') throw new Error('El evento no está abierto para inscripciones');
    if (eventData.currentRegistrations >= eventData.maxCapacity) throw new Error('El evento está lleno');

    eventName = eventData.name;
    newCount = eventData.currentRegistrations + 1;
    maxCapacity = eventData.maxCapacity;

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
      currentRegistrations: newCount,
      updatedAt: serverTimestamp(),
    });
  });

  // Fire-and-forget notification (admin)
  sendTelegramMessage(
    formatMsg({
      emoji: '✅',
      title: 'Nueva inscripción',
      body: `👤 ${user.displayName}\n🏆 ${eventName}\n👥 Cupo: ${newCount}/${maxCapacity}`,
    }),
    'admin'
  );
}

export async function cancelRegistration(registrationId: string, eventId: string): Promise<void> {
  let eventName = '';
  let userName = '';
  let newCount = 0;
  let maxCapacity = 0;

  await runTransaction(db, async (transaction) => {
    const regRef = doc(db, 'registrations', registrationId);
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await transaction.get(eventRef);
    const regSnap = await transaction.get(regRef);

    if (!eventSnap.exists()) throw new Error('Evento no encontrado');
    if (!regSnap.exists()) throw new Error('Inscripción no encontrada');

    const eventData = eventSnap.data();
    eventName = eventData.name;
    userName = regSnap.data().userName;
    newCount = Math.max(0, eventData.currentRegistrations - 1);
    maxCapacity = eventData.maxCapacity;

    transaction.update(regRef, {
      status: 'cancelled',
      paymentStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });

    transaction.update(eventRef, {
      currentRegistrations: newCount,
      updatedAt: serverTimestamp(),
    });
  });

  // Fire-and-forget notification (admin)
  sendTelegramMessage(
    formatMsg({
      emoji: '❌',
      title: 'Baja de inscripción',
      body: `👤 ${userName}\n🏆 ${eventName}\n👥 Cupo: ${newCount}/${maxCapacity}`,
    }),
    'admin'
  );

  // Si se liberó cupo y hay waitlist, avisar al grupo (fire-and-forget)
  void notifyWaitlistOnSpotFreed(eventId, eventName, newCount, maxCapacity);
}

async function notifyWaitlistOnSpotFreed(
  eventId: string,
  eventName: string,
  currentCount: number,
  maxCapacity: number
): Promise<void> {
  try {
    const waitlistRef = collection(db, 'waitlist');
    const q = query(waitlistRef, where('eventId', '==', eventId), where('notified', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) return;

    sendTelegramMessage(
      formatMsg({
        emoji: '🎟️',
        title: 'Se liberó cupo',
        body: `🏆 ${eventName}\n👥 Cupo: ${currentCount}/${maxCapacity}\n\n¡El primero que se anote se lleva el lugar!`,
      }),
      'group'
    );

    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(db, 'waitlist', d.id), { notified: true, notifiedAt: serverTimestamp() })
      )
    );
  } catch (err) {
    console.warn('[waitlist] notify failed:', err);
  }
}

export async function getEventRegistrations(eventId: string): Promise<Registration[]> {
  const q = query(registrationsRef, where('eventId', '==', eventId), where('status', '==', 'active'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration));
}

export async function getUserEventRegistration(eventId: string, userId: string): Promise<Registration | null> {
  const q = query(registrationsRef, where('eventId', '==', eventId), where('userId', '==', userId), where('status', '==', 'active'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Registration;
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

export async function deleteEventRegistrations(eventId: string): Promise<void> {
  const q = query(registrationsRef, where('eventId', '==', eventId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'registrations', d.id));
  }
}

export async function deleteEventWaitlist(eventId: string): Promise<void> {
  const waitlistRef = collection(db, 'waitlist');
  const q = query(waitlistRef, where('eventId', '==', eventId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'waitlist', d.id));
  }
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
