import type { Timestamp } from 'firebase/firestore';

// Roles
export type UserRole = 'admin' | 'collaborator' | 'player';

// Player position
export type PlayerPosition = 'drive' | 'reves' | 'indistinto';

// Event status
export type EventStatus = 'draft' | 'published' | 'closed' | 'finished' | 'cancelled';

// Tournament type
export type TournamentType = 'liga' | 'libre' | 'americano' | 'rey';

// Rey de Cancha
export interface ReyCourt {
  id: string;
  name: string;
  order: number;
}

export interface ReyConfig {
  courts: ReyCourt[];
  winnersCourtId: string;
  losersCourtId: string;
  seedMode: 'random' | 'manual';
}

// Payment status
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';

// Registration status
export type RegistrationStatus = 'active' | 'cancelled';

// Americano tournament
export type AmericanoPhase = 'setup' | 'groups' | 'repechaje' | 'elimination' | 'finished';
export type MatchPhase = 'group' | 'repechaje' | 'elimination';

export interface AmericanoConfig {
  minMatches: number;
  groupCount: number;
  directQualifiers: number;
}

// User
export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  telegramUsername?: string;
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
  americanoConfig?: AmericanoConfig;
  americanoPhase?: AmericanoPhase;
  reyConfig?: ReyConfig;
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
  phase?: MatchPhase;
  groupNumber?: number;
  bracketRound?: number;
  bracketPosition?: number;
  courtId?: string;
  courtName?: string;
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

// Event Group (americano)
export interface EventGroup {
  id: string;
  eventId: string;
  groupNumber: number;
  pairIds: string[];
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
  telegramUsername?: string;
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
