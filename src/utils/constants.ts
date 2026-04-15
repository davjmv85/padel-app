import type { AmericanoPhase, EventStatus, PaymentStatus, PlayerPosition, TournamentType, UserRole } from '@/types';

export const ROLES: Record<UserRole, string> = {
  admin: 'Administrador',
  collaborator: 'Colaborador',
  player: 'Jugador',
};

export const EVENT_STATUSES: Record<EventStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  closed: 'Cerrado',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUSES: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

export const PLAYER_POSITIONS: Record<PlayerPosition, string> = {
  drive: 'Drive',
  reves: 'Revés',
  indistinto: 'Indistinto',
};

export const TOURNAMENT_TYPES: Record<TournamentType, string> = {
  liga: 'Liga',
  libre: 'Libre',
  americano: 'Americano',
  rey: 'Rey de Cancha',
};

export const AMERICANO_PHASES: Record<AmericanoPhase, string> = {
  setup: 'Configuración',
  groups: 'Fase de Grupos',
  repechaje: 'Repechaje',
  elimination: 'Eliminatoria',
  finished: 'Finalizado',
};

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
