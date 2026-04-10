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
import { sendTelegramMessage } from '@/lib/telegram';
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

  // Fire-and-forget notification
  sendTelegramMessage(
    `✅ <b>Nueva inscripción</b>\n\n👤 ${user.displayName}\n🏆 ${eventName}\n👥 Cupo: ${newCount}/${maxCapacity}`
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

  // Fire-and-forget notification
  sendTelegramMessage(
    `❌ <b>Baja de inscripción</b>\n\n👤 ${userName}\n🏆 ${eventName}\n👥 Cupo: ${newCount}/${maxCapacity}`
  );
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
