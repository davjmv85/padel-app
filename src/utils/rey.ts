import type { ReyConfig, ReyCourt, Match, EventPair } from '@/types';

export interface ReyValidation {
  errors: string[];
  warnings: string[];
  summary: {
    totalCourts: number;
    pairsPerRound: number;
    restingPerRound: number;
  } | null;
}

export function validateReyConfig(config: ReyConfig, totalPairs: number): ReyValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { courts, winnersCourtId, losersCourtId } = config;

  if (courts.length < 1) {
    errors.push('Agregá al menos una cancha');
    return { errors, warnings, summary: null };
  }
  if (!courts.find(c => c.id === winnersCourtId)) {
    errors.push('La cancha de referencia de ganadores no existe');
  }
  if (!courts.find(c => c.id === losersCourtId)) {
    errors.push('La cancha de referencia de perdedores no existe');
  }

  const pairsPerRound = courts.length * 2;
  const restingPerRound = Math.max(0, totalPairs - pairsPerRound);

  if (totalPairs < pairsPerRound) {
    warnings.push(`Hay ${totalPairs} parejas para ${pairsPerRound} lugares.`);
  }

  if (errors.length > 0) return { errors, warnings, summary: null };

  return {
    errors,
    warnings,
    summary: {
      totalCourts: courts.length,
      pairsPerRound,
      restingPerRound,
    },
  };
}

export function generateRandomId(): string {
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Shuffle utility (deterministic-ish with Math.random).
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Round-1 distribution: 2 pairs per court in order. Extra pairs rest.
 * Returns pairs grouped by courtId, with restingPairs separately.
 */
export function buildInitialRoundAssignment(
  pairIds: string[],
  courts: ReyCourt[],
  _seedMode: 'random' | 'manual',
  manualAssignment?: Record<string, string[]> // courtId -> pairIds (exactly 2)
): { assignments: Map<string, [string, string]>; resting: string[] } {
  const sortedCourts = [...courts].sort((a, b) => a.order - b.order);
  const assignments = new Map<string, [string, string]>();

  // Honor manualAssignment whenever it's provided — its presence is the
  // explicit signal. seedMode is kept for API compatibility.
  if (manualAssignment) {
    const used = new Set<string>();
    for (const c of sortedCourts) {
      const pair = manualAssignment[c.id];
      if (pair && pair.length === 2) {
        assignments.set(c.id, [pair[0], pair[1]]);
        used.add(pair[0]);
        used.add(pair[1]);
      }
    }
    const resting = pairIds.filter(id => !used.has(id));
    return { assignments, resting };
  }

  // Random
  const shuffled = shuffle(pairIds);
  const resting: string[] = [];
  let cursor = 0;
  for (const c of sortedCourts) {
    if (cursor + 1 < shuffled.length) {
      assignments.set(c.id, [shuffled[cursor], shuffled[cursor + 1]]);
      cursor += 2;
    }
  }
  while (cursor < shuffled.length) {
    resting.push(shuffled[cursor]);
    cursor++;
  }
  return { assignments, resting };
}

/**
 * Given a court's order and target reference order, returns the next court's order
 * (+1, -1 or 0 if already there).
 */
export function nextCourtOrder(currentOrder: number, targetOrder: number): number {
  if (currentOrder === targetOrder) return currentOrder;
  return currentOrder + Math.sign(targetOrder - currentOrder);
}

export interface RoundPlan {
  assignments: Map<string, [string, string]>;
  resting: string[];
}

/**
 * Build the next round from the outcome of the previous round.
 * Repeats are allowed — it's part of the dynamic of Rey de Cancha.
 */
export function planNextRound(
  previousRoundMatches: Match[],
  previousResting: string[],
  allPairIds: string[],
  config: ReyConfig,
  pairsPlayedCount: Map<string, number>
): RoundPlan {
  const courts = [...config.courts].sort((a, b) => a.order - b.order);
  const winnersCourt = courts.find(c => c.id === config.winnersCourtId);
  const losersCourt = courts.find(c => c.id === config.losersCourtId);
  if (!winnersCourt || !losersCourt) {
    return { assignments: new Map(), resting: [...allPairIds] };
  }

  const bucketByOrder = new Map<number, string[]>();
  for (const c of courts) bucketByOrder.set(c.order, []);

  for (const m of previousRoundMatches) {
    if (!m.courtId || !m.winnerId) continue;
    const court = courts.find(c => c.id === m.courtId);
    if (!court) continue;
    const loserId = m.winnerId === m.pairAId ? m.pairBId : m.pairAId;
    const winnerNextOrder = nextCourtOrder(court.order, winnersCourt.order);
    const loserNextOrder = nextCourtOrder(court.order, losersCourt.order);
    bucketByOrder.get(winnerNextOrder)!.push(m.winnerId);
    bucketByOrder.get(loserNextOrder)!.push(loserId);
  }

  const playCount = (id: string) => pairsPlayedCount.get(id) ?? 0;

  const restingPool: string[] = [...previousResting];
  for (const [order, bucket] of bucketByOrder.entries()) {
    if (bucket.length > 2) {
      bucket.sort((a, b) => playCount(a) - playCount(b));
      const kept = bucket.slice(0, 2);
      const extra = bucket.slice(2);
      bucketByOrder.set(order, kept);
      restingPool.push(...extra);
    }
  }

  restingPool.sort((a, b) => playCount(a) - playCount(b));
  for (const c of courts) {
    const bucket = bucketByOrder.get(c.order)!;
    while (bucket.length < 2 && restingPool.length > 0) {
      bucket.push(restingPool.shift()!);
    }
  }

  const assignments = new Map<string, [string, string]>();
  for (const c of courts) {
    const bucket = bucketByOrder.get(c.order)!;
    if (bucket.length === 2) {
      assignments.set(c.id, [bucket[0], bucket[1]]);
    }
  }

  return { assignments, resting: restingPool };
}

export function getPairName(pairs: EventPair[], id: string): string {
  const p = pairs.find(p => p.id === id);
  return p ? `${p.player1Name} / ${p.player2Name}` : 'Desconocida';
}
