import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  unlink,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, position: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  reloadUser: () => Promise<void>;
  isEmailVerified: boolean;
  isAdmin: boolean;
  isCollaborator: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setAppUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
        } else {
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string, position: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const userData = {
      email,
      displayName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      position,
      role: 'player' as UserRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), userData);
    setAppUser({ id: cred.user.uid, ...userData } as unknown as AppUser);
    // Send verification email
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.error('Error sending verification email:', err);
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userDocSnap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!userDocSnap.exists()) {
      const names = cred.user.displayName?.split(' ') || ['', ''];
      const userData = {
        email: cred.user.email || '',
        displayName: cred.user.displayName || '',
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || '',
        position: 'indistinto' as const,
        role: 'player' as UserRole,
        photoURL: cred.user.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), userData);
      setAppUser({ id: cred.user.uid, ...userData } as unknown as AppUser);
    }
    // Unlink password provider if it exists — Google is now the only sign-in method
    const hasPassword = cred.user.providerData.some((p) => p.providerId === 'password');
    if (hasPassword) {
      try {
        await unlink(cred.user, 'password');
      } catch (err) {
        console.error('Error unlinking password provider:', err);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (!user) throw new Error('No hay usuario logueado');
    await sendEmailVerification(user);
  };

  const reloadUser = async () => {
    if (!user) return;
    await reload(user);
    setUser({ ...user });
  };

  const role = appUser?.role;
  const isAdmin = role === 'admin';
  const isCollaborator = role === 'collaborator';
  const isStaff = isAdmin || isCollaborator;
  // Verified if Firebase says so OR if the account was admin-created (seed)
  const isEmailVerified = !!(user?.emailVerified || appUser?.adminCreated);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, login, register, loginWithGoogle, logout, resetPassword, resendVerification, reloadUser, isEmailVerified, isAdmin, isCollaborator, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
