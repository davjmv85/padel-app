import type { Timestamp } from 'firebase/firestore';

// Roles
export type UserRole = 'admin' | 'collaborator' | 'player';

// Player position
export type PlayerPosition = 'drive' | 'reves' | 'indistinto';

// Event status
export type EventStatus = 'draft' | 'published' | 'closed' | 'finished' | 'cancelled';

// Tournament type
export type TournamentType = 'liga' | 'libre';

// Payment status
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';

// Registration status
export type RegistrationStatus = 'active' | 'cancelled';

// User
export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  position: PlayerPosition;
  role: UserRole;
  photoURL?: string;
  adminCreated?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Event
export interface PadelEvent {
  id: string;
  name: string;
  location: string;
  date: Timestamp;
  time: string;
  maxCapacity: number;
  price: number;
  description?: string;
  status: EventStatus;
  tournamentType: TournamentType;
  currentRegistrations: number;
  createdBy: string;
  createdByEmail?: string;
  createdByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Registration
export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userPosition: PlayerPosition;
  paymentStatus: PaymentStatus;
  paidMarkedBy?: string;
  paidAt?: Timestamp;
  status: RegistrationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Event Pair
export interface EventPair {
  id: string;
  eventId: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  round?: number; // Used in 'libre' tournaments to group pairs by fecha
  createdAt: Timestamp;
}

// Match
export interface Match {
  id: string;
  eventId: string;
  pairAId: string;
  pairAName?: string;
  pairBId: string;
  pairBName?: string;
  scoreA: string;
  scoreB: string;
  winnerId: string;
  round?: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Ranking
export interface RankingEntry {
  id: string;
  userId: string;
  userName: string;
  totalPoints: number;
  matchesWon: number;
  matchesPlayed: number;
  updatedAt: Timestamp;
}

// Waitlist
export interface WaitlistEntry {
  id: string;
  eventId: string;
  userId: string;
  userEmail: string;
  notified: boolean;
  createdAt: Timestamp;
}

// Form types (without Timestamp, for forms)
export interface EventFormData {
  name: string;
  location: string;
  date: string;
  time: string;
  maxCapacity: number;
  price: number;
  description?: string;
  status: EventStatus;
  tournamentType: TournamentType;
}

export interface ProfileFormData {
  firstName: string;
  lastName: string;
  nickname?: string;
  position: PlayerPosition;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  position: PlayerPosition;
}

export interface LoginFormData {
  email: string;
  password: string;
}
