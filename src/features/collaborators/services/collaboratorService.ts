import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/types';

const usersRef = collection(db, 'users');

export async function getCollaborators(): Promise<AppUser[]> {
  const q = query(usersRef, where('role', '==', 'collaborator'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
}

export async function searchUsers(emailQuery: string): Promise<AppUser[]> {
  // Firestore doesn't support LIKE queries. We search by exact email or prefix.
  // For MVP, search by exact email match
  const q = query(usersRef, where('email', '==', emailQuery));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
}

export async function setUserRole(userId: string, role: 'collaborator' | 'player'): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    role,
    updatedAt: serverTimestamp(),
  });
}
