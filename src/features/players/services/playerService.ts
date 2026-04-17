import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/types';

const usersRef = collection(db, 'users');

/**
 * Devuelve todos los usuarios registrados en el sistema,
 * filtrando los que tienen email con sufijo ".pdl@gmail.com" (cuentas seed).
 */
export async function getAllPlayers(): Promise<AppUser[]> {
  const snap = await getDocs(usersRef);
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
  return users.filter((u) => !u.email?.toLowerCase().endsWith('.pdl@gmail.com'));
}
